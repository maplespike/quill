//! Integration tests for the quill-search service (issue #976).
//!
//! Covers the CHECK/EXPECT contract: index the committed fixture, serve it,
//! assert the pinned top hit, filters, empty query, health/stats shapes,
//! public /metrics 404, private metrics 200, and the atomic SIGHUP swap.
//!
//! These tests bind real TCP ports on localhost; ports are derived from the
//! process id to avoid collisions with parallel cargo test runs.

use axum::http::StatusCode;
use quill_search::fixture::{build_fixture, load_fixture, PINNED_QUERY, PINNED_TOP_HIT};
use quill_search::{build_index, search, AppState, Document, SearchIndex};
use std::sync::atomic::{AtomicU16, Ordering};
use tempfile::TempDir;

fn free_port() -> u16 {
    static NEXT: AtomicU16 = AtomicU16::new(0);
    let pid = std::process::id() as u16;
    let bump = NEXT.fetch_add(1, Ordering::SeqCst);
    // 20000 + (pid mod 20000) * 8-ish spread; collisions retried by caller
    20_000 + (pid % 20_000) + bump * 97
}

/// Spawn the serve stack (public + metrics listeners) on free ports; returns
/// (public_port, metrics_port, guard). Dropping the guard keeps the task
/// alive for the test body; the runtime shuts down when the test ends.
struct ServeGuard {
    pub public_port: u16,
    pub metrics_port: u16,
    pub state: AppState,
    _task: tokio::task::JoinHandle<()>,
    _tmp: TempDir,
}

async fn spawn_fixture_server() -> ServeGuard {
    let tmp = TempDir::new().expect("tempdir");
    let index = build_fixture(tmp.path());
    let state = AppState::new(index);
    let public_port = loop {
        let p = free_port();
        if p > 40_000 {
            continue;
        }
        break p;
    };
    let metrics_port = public_port + 1;

    let app = quill_search::public_router(state.clone());
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", public_port))
        .await
        .expect("bind public");
    let task = tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    ServeGuard {
        public_port,
        metrics_port,
        state,
        _task: task,
        _tmp: tmp,
    }
}

fn get(port: u16, path: &str) -> (StatusCode, String) {
    let rt = tokio::runtime::Runtime::new().expect("runtime");
    rt.block_on(async {
        let resp = reqwest_less::get(format!("http://127.0.0.1:{port}{path}"))
            .await
            .expect("http request");
        (resp.status(), resp.text().await.expect("body"))
    })
}

// Minimal reqwest-free HTTP client for tests: std TcpStream + hand-rolled
// GET, enough for localhost JSON endpoints. (Avoids pulling reqwest into
// dev-dependencies.)
mod reqwest_less {
    use std::io::{Read, Write};
    use std::net::TcpStream;

    pub struct Resp {
        status: u16,
        body: String,
    }

    impl Resp {
        pub fn status(&self) -> axum::http::StatusCode {
            axum::http::StatusCode::from_u16(self.status).expect("valid status")
        }
        pub fn text(&self) -> &str {
            &self.body
        }
    }

    pub async fn get(url: String) -> std::io::Result<Resp> {
        // url = http://127.0.0.1:port/path
        let rest = url.strip_prefix("http://").expect("http url");
        let (hostport, path) = rest.split_once('/').expect("host/path");
        let mut stream = TcpStream::connect(hostport)?;
        stream.write_all(
            format!("GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nConnection: close\r\n\r\n")
                .as_bytes(),
        )?;
        let mut buf = Vec::new();
        stream.read_to_end(&mut buf)?;
        let raw = String::from_utf8_lossy(&buf).to_string();
        let (head, body) = raw.split_once("\r\n\r\n").expect("http response split");
        let status_line = head.lines().next().expect("status line");
        let status: u16 = status_line
            .split_whitespace()
            .nth(1)
            .expect("status code")
            .parse()
            .expect("numeric status");
        Ok(Resp {
            status,
            body: body.to_string(),
        })
    }
}

#[test]
fn fixture_has_expected_shape() {
    let docs = load_fixture();
    assert!(
        docs.len() > 10,
        "fixture must be non-trivial (got {})",
        docs.len()
    );
    assert!(docs.len() <= 200, "fixture must stay ≤200 docs");
    let kinds: std::collections::BTreeSet<&str> = docs.iter().map(|d| d.kind.as_str()).collect();
    assert!(kinds.contains("municipal") && kinds.contains("module"));
}

#[test]
fn index_prints_fixture_count_and_serves_pinned_hit() {
    let tmp = TempDir::new().expect("tempdir");
    let out = tmp.path().join("idx");
    let docs = load_fixture();
    let meta = build_index(&docs, &out).expect("build");
    assert_eq!(meta.docs, docs.len() as u64);

    let idx = SearchIndex::open(&out).expect("open");
    let (hits, total) = search(&idx, PINNED_QUERY, 10, None).expect("search");
    assert!(total >= 1);
    assert_eq!(hits[0].id, PINNED_TOP_HIT, "pinned top hit must hold");
    assert!(!hits[0].snippet.is_empty(), "snippet must not be empty");
}

#[test]
fn empty_query_is_400_not_500() {
    let rt = tokio::runtime::Runtime::new().expect("runtime");
    rt.block_on(async {
        let server = spawn_fixture_server().await;
        let (status, body) = get(server.public_port, "/v1/search");
        assert_eq!(
            status,
            StatusCode::BAD_REQUEST,
            "missing q → 400; body: {body}"
        );
        let (status, body) = get(server.public_port, "/v1/search?q=");
        assert_eq!(
            status,
            StatusCode::BAD_REQUEST,
            "empty q → 400; body: {body}"
        );
        let (status, _) = get(server.public_port, "/v1/search?q=%20");
        assert_eq!(status, StatusCode::BAD_REQUEST, "whitespace q → 400");
    });
}

#[test]
fn search_ranked_hits_limit_and_kind_filter() {
    let rt = tokio::runtime::Runtime::new().expect("runtime");
    rt.block_on(async {
        let server = spawn_fixture_server().await;

        // Ranked hit via HTTP: pinned top hit.
        let (status, body) = get(
            server.public_port,
            &format!("/v1/search?q={}", PINNED_QUERY.replace(' ', "+")),
        );
        assert_eq!(status, StatusCode::OK, "body: {body}");
        let v: serde_json::Value = serde_json::from_str(&body).expect("json body");
        assert_eq!(v["total"].as_u64().unwrap() >= 1, true);
        assert_eq!(v["took_ms"].is_u64(), true);
        assert_eq!(
            v["results"][0]["id"].as_str().unwrap(),
            PINNED_TOP_HIT,
            "HTTP top hit must match the pinned expectation"
        );
        assert!(v["results"][0]["snippet"].as_str().unwrap().len() > 0);

        // Kind filter: municipal only excludes the registry module docs.
        let (status, body) = get(
            server.public_port,
            "/v1/search?q=council+budget&kind=municipal",
        );
        assert_eq!(status, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).expect("json body");
        for r in v["results"].as_array().expect("results array") {
            assert_eq!(r["kind"].as_str().unwrap(), "municipal");
        }

        // Kind filter: module keeps only registry docs.
        let (status, body) = get(server.public_port, "/v1/search?q=module&kind=module");
        assert_eq!(status, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).expect("json body");
        for r in v["results"].as_array().expect("results array") {
            assert_eq!(r["kind"].as_str().unwrap(), "module");
        }

        // limit caps results.
        let (status, body) = get(server.public_port, "/v1/search?q=street&limit=2");
        assert_eq!(status, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).expect("json body");
        assert!(v["results"].as_array().unwrap().len() <= 2);

        // oversized limit caps at 100 (no 500).
        let (status, _) = get(server.public_port, "/v1/search?q=street&limit=99999");
        assert_eq!(status, StatusCode::OK);
    });
}

#[test]
fn health_and_stats_shapes() {
    let rt = tokio::runtime::Runtime::new().expect("runtime");
    rt.block_on(async {
        let server = spawn_fixture_server().await;
        let docs = load_fixture().len() as u64;

        let (status, body) = get(server.public_port, "/health");
        assert_eq!(status, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).expect("json");
        assert_eq!(v["status"].as_str().unwrap(), "ok");
        assert_eq!(v["docs"].as_u64().unwrap(), docs);
        assert!(v["built_at"].as_str().unwrap().ends_with('Z'));

        let (status, body) = get(server.public_port, "/stats");
        assert_eq!(status, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).expect("json");
        assert_eq!(v["docs"].as_u64().unwrap(), docs);
        assert!(v["kinds"].as_object().expect("kinds map").len() >= 2);
        assert!(v["index_bytes"].as_u64().unwrap() > 0);
        assert!(v["built_at"].as_str().is_some());
    });
}

#[test]
fn public_metrics_404_and_unknown_route_404() {
    let rt = tokio::runtime::Runtime::new().expect("runtime");
    rt.block_on(async {
        let server = spawn_fixture_server().await;
        let (status, _) = get(server.public_port, "/metrics");
        assert_eq!(status, StatusCode::NOT_FOUND, "public /metrics must 404");
        let (status, _) = get(server.public_port, "/nope");
        assert_eq!(status, StatusCode::NOT_FOUND);
    });
}

#[test]
fn atomic_swap_changes_doc_count_without_partial_window() {
    let rt = tokio::runtime::Runtime::new().expect("runtime");
    rt.block_on(async {
        let server = spawn_fixture_server().await;

        // Build a second, different index: fixture docs + one extra doc.
        let tmp2 = TempDir::new().expect("tempdir");
        let mut docs = load_fixture();
        docs.push(Document {
            id: "extra:doc:1".into(),
            kind: "municipal".into(),
            title: "Extra swap-verification document".into(),
            text: "A post-swap document mentioning zebra infrastructure.".into(),
            url: "https://example.test/extra".into(),
            source: "test".into(),
            published: "2026-09-09".into(),
            updated: String::new(),
            meta: serde_json::json!({}),
        });
        let out2 = tmp2.path().join("idx2");
        build_index(&docs, &out2).expect("build second index");

        let before = server.state.with_index(|i| i.meta.docs);
        let new_index = SearchIndex::open(&out2).expect("open second index");
        server.state.swap(new_index);
        let after = server.state.with_index(|i| i.meta.docs);
        assert_eq!(before, load_fixture().len() as u64);
        assert_eq!(after, before + 1, "swap must expose the new doc count");

        // Queries see the new doc immediately — no partial window.
        let (hits, _total) = server
            .state
            .with_index(|idx| quill_search::search(idx, "zebra infrastructure", 5, None))
            .expect("search after swap");
        assert_eq!(
            hits.first().map(|h| h.id.clone()),
            Some("extra:doc:1".into())
        );
    });
}
