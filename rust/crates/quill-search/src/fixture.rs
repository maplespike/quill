//! Shared test fixture: the committed ≤200-doc sample corpus
//! (`rust/fixtures/sample.jsonl`) plus the bench-support seam the criterion
//! benches use. The fixture's pinned query ("bloor street construction")
//! asserts `toronto:contracts:1` as the top hit in integration tests — the
//! same expectation the dark-deploy probe checks.

use crate::corpus::Document;
use crate::index::{build_index, search, SearchIndex};

pub const FIXTURE_RELATIVE_PATH: &str = "fixtures/sample.jsonl";
/// The pinned fixture query (CHECK/EXPECT in issue #976).
pub const PINNED_QUERY: &str = "bloor street construction";
/// The pinned expected top hit for `PINNED_QUERY`.
pub const PINNED_TOP_HIT: &str = "toronto:contracts:1";

/// Locate `rust/fixtures/sample.jsonl` relative to the crate (CARGO_MANIFEST_DIR
/// = rust/crates/quill-search). Works from tests and benches alike.
pub fn fixture_path() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../")
        .join(FIXTURE_RELATIVE_PATH)
}

/// Load the committed fixture corpus.
pub fn load_fixture() -> Vec<Document> {
    crate::corpus::load_corpus(&fixture_path()).expect("fixture corpus must parse")
}

/// Build the fixture into `out_dir`; returns the open index.
pub fn build_fixture(out_dir: &std::path::Path) -> SearchIndex {
    let docs = load_fixture();
    build_index(&docs, out_dir).expect("fixture index must build");
    SearchIndex::open(out_dir).expect("fixture index must open")
}

/// Run the pinned fixture query; returns the top-hit id (must equal
/// `PINNED_TOP_HIT` — asserted in integration tests).
pub fn pinned_top_hit(idx: &SearchIndex) -> String {
    let (hits, _total) = search(idx, PINNED_QUERY, 10, None).expect("pinned query must run");
    hits.first().expect("pinned query must hit").id.clone()
}
