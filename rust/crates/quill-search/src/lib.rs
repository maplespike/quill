#[cfg(feature = "bench")]
pub mod bench_support;
mod corpus;
pub mod fixture;
mod index;
mod serve;

pub use corpus::{CorpusError, Document};
pub use index::{build_index, search, IndexMeta, SearchHit, SearchIndex, META_FILE};
pub use serve::{AppState, DEFAULT_LIMIT, DEFAULT_METRICS_PORT, DEFAULT_PUBLIC_PORT, MAX_LIMIT, health_handler, search_handler, stats_handler};
pub use axum::Router;
pub use axum::routing::get;

/// The public axum router (health, search, stats). Exposed for
/// integration tests that bind their own listener.
pub fn public_router(state: AppState) -> axum::Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/v1/search", get(search_handler))
        .route("/stats", get(stats_handler))
        .with_state(state)
}
