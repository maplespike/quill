/// Bind the public listener + the private metrics listener; swap the index on
/// SIGHUP. Runs until SIGTERM/SIGINT.
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use anyhow::Context;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use metrics_exporter_prometheus::PrometheusBuilder;
use tokio::signal;
use tokio::signal::unix::{signal, SignalKind};
use tracing::{error, info};

use crate::index::SearchIndex;

/// Default limits for pagination.
pub const DEFAULT_LIMIT: usize = 20;
/// Default port for the public HTTP API.
pub const DEFAULT_PUBLIC_PORT: u16 = 8083;
/// Default port for the private metrics HTTP API.
pub const DEFAULT_METRICS_PORT: u16 = 9466;
/// Maximum allowed limit for pagination.
pub const MAX_LIMIT: usize = 100;

/// Shared state holding the current search index.
#[derive(Clone)]
pub struct AppState {
    index: Arc<RwLock<SearchIndex>>,
}

impl AppState {
    pub fn new(index: SearchIndex) -> Self {
        Self {
            index: Arc::new(RwLock::new(index)),
        }
    }

    /// Read the current index with a closure (public: handlers, tests, and
    /// embedders all go through this one accessor).
    pub fn with_index<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&SearchIndex) -> R,
    {
        let guard = self.index.read().unwrap_or_else(|e| e.into_inner());
        f(&guard)
    }

    /// Swap the current index with a new one.
    pub fn swap(&self, new_index: SearchIndex) {
        *self.index.write().unwrap_or_else(|e| e.into_inner()) = new_index;
    }
}

/// Build the public axum router (health, search, stats).
fn public_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/v1/search", get(search_handler))
        .route("/stats", get(stats_handler))
        .with_state(state)
}

pub async fn health_handler(State(state): State<AppState>) -> impl IntoResponse {
    let (docs, built_at) = state.with_index(|idx| (idx.meta.docs, idx.meta.built_at.clone()));
    let body = serde_json::json!({
        "status": "ok",
        "docs": docs,
        "built_at": built_at,
    });
    (StatusCode::OK, axum::Json(body))
}

pub async fn search_handler(
    State(state): State<AppState>,
    Query(params): Query<serde_json::Value>,
) -> impl IntoResponse {
    let query = params
        .get("q")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if query.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            axum::Json(serde_json::json!({ "error": "missing or empty q" })),
        );
    }
    let limit = params
        .get("limit")
        .and_then(|v| {
            // Query params arrive as JSON strings; accept both shapes.
            v.as_u64()
                .or_else(|| v.as_str().and_then(|s| s.parse::<u64>().ok()))
        })
        .map(|v| v as usize)
        .unwrap_or(DEFAULT_LIMIT)
        .min(MAX_LIMIT);
    let kind = params
        .get("kind")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());

    let started = std::time::Instant::now();
    let (hits, total) = state.with_index(|idx| {
        crate::index::search(idx, &query, limit, kind.as_deref()).expect("search failed")
    });
    let took_ms = started.elapsed().as_millis() as u64;

    let results = hits
        .into_iter()
        .map(|hit| {
            serde_json::json!({
                "id": hit.id,
                "kind": hit.kind,
                "title": hit.title,
                "text": hit.text,
                "url": hit.url,
                "source": hit.source,
                "published": hit.published,
                "updated": hit.updated,
                "meta": hit.meta,
                "snippet": hit.snippet,
            })
        })
        .collect::<serde_json::Value>();

    let body = serde_json::json!({
        "took_ms": took_ms,
        "total": total,
        "limit": limit,
        "kind": kind,
        "query": query,
        "results": results,
    });
    (StatusCode::OK, axum::Json(body))
}

pub async fn stats_handler(State(state): State<AppState>) -> impl IntoResponse {
    let (meta, index_bytes) = state.with_index(|idx| (idx.meta.clone(), idx.index_bytes()));
    let body = serde_json::json!({
        "docs": meta.docs,
        "kinds": meta.kinds,
        "index_bytes": index_bytes,
        "built_at": meta.built_at,
    });
    (StatusCode::OK, axum::Json(body))
}

pub async fn serve(index_dir: PathBuf, public_port: u16, metrics_port: u16) -> anyhow::Result<()> {
    let index = SearchIndex::open(&index_dir)
        .with_context(|| format!("cannot open index at `{}`", index_dir.display()))?;
    let state = AppState::new(index);

    // Private metrics listener: bounded exporter (counters + one histogram + one gauge), Prometheus text format.
    let exporter = PrometheusBuilder::new()
        .install_recorder()
        .context("cannot install Prometheus metrics exporter")?;

    let metrics_app = Router::new().route(
        "/metrics",
        get(move || {
            let exporter = exporter.clone();
            async move {
                let body = exporter.render();
                (
                    StatusCode::OK,
                    [("content-type", "text/plain; charset=utf-8")],
                    body,
                )
            }
        }),
    );
    let metrics_addr = SocketAddr::from(([0, 0, 0, 0], metrics_port));
    let metrics_listener = tokio::net::TcpListener::bind(metrics_addr)
        .await
        .with_context(|| format!("cannot bind metrics port {metrics_port}"))?;
    let metrics_port_bound = metrics_port;
    tokio::spawn(async move {
        if let Err(e) = axum::serve(metrics_listener, metrics_app).await {
            error!("metrics listener on {metrics_port_bound} failed: {e}");
        }
    });

    let public_addr = SocketAddr::from(([0, 0, 0, 0], public_port));
    let listener = tokio::net::TcpListener::bind(public_addr)
        .await
        .with_context(|| format!("cannot bind public port {public_port}"))?;
    tracing::info!(
        "quill-search serving {} docs on 0.0.0.0:{public_port} (metrics on :{metrics_port})",
        state.with_index(|i| i.meta.docs)
    );

    // SIGHUP → atomic index swap: reopen `index_dir` (a completed build) and
    // swap the handle. A failed reopen keeps the current index serving.
    let sighup_state = state.clone();
    let sighup_dir = index_dir.clone();
    tokio::spawn(async move {
        let mut sighup_stream = match signal(SignalKind::hangup()) {
            Ok(stream) => stream,
            Err(e) => {
                error!("cannot install SIGHUP handler: {e}");
                return;
            }
        };
        while sighup_stream.recv().await.is_some() {
            info!("SIGHUP: reloading index from {}", sighup_dir.display());
            match SearchIndex::open(&sighup_dir) {
                Ok(new_index) => {
                    sighup_state.swap(new_index);
                    info!(
                        "index swapped; now serving {} docs",
                        sighup_state.with_index(|i| i.meta.docs)
                    );
                }
                Err(e) => {
                    error!("SIGHUP reload failed (keeping current index): {e}");
                }
            }
        }
    });

    // SIGTERM → graceful shutdown.
    let terminate = async {
        match signal(SignalKind::terminate()) {
            Ok(mut stream) => {
                stream.recv().await;
            }
            Err(e) => {
                error!("cannot install SIGTERM handler: {e}");
            }
        }
    };

    let ctrl_c = async {
        signal::ctrl_c().await;
    };

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    axum::serve(listener, public_router(state))
        .await
        .context("public listener failed")?;
    Ok(())
}
