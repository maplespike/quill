#[cfg(feature = "bench")]
pub mod bench_support;
pub mod corpus;
pub mod fixture;
pub mod index;
pub mod serve;

pub use axum::routing::get;
pub use axum::Router;
pub use corpus::{CorpusError, Document};
pub use index::{build_index, search, IndexMeta, SearchHit, SearchIndex, META_FILE};
pub use serve::{
    health_handler, search_handler, stats_handler, AppState, DEFAULT_LIMIT, DEFAULT_METRICS_PORT,
    DEFAULT_PUBLIC_PORT, MAX_LIMIT,
};

/// The public axum router (health, search, stats). Exposed for
/// integration tests that bind their own listener.
pub fn public_router(state: AppState) -> axum::Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/v1/search", get(search_handler))
        .route("/stats", get(stats_handler))
        .with_state(state)
}
