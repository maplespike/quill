//! Bench support (feature `bench`): deterministic corpus generation via
//! quill-search-bench-gen + hot-path wrappers. Compiled only for criterion
//! benches; never part of the service binary.

use crate::corpus::Document;
use crate::index::{build_index, search as index_search, SearchHit, SearchIndex};

#[cfg(feature = "bench")]
pub struct BenchCorpus {
    pub docs: Vec<Document>,
}

#[cfg(feature = "bench")]
impl BenchCorpus {
    /// Generate `n` deterministic docs into `dir` as JSONL, then parse.
    pub fn generate(dir: &std::path::Path, n: u64, seed: u64) -> Self {
        std::fs::create_dir_all(dir).expect("corpus dir");
        let path = dir.join("bench.jsonl");
        quill_search_bench_gen::generate_to(&path, n, seed).expect("generate corpus");
        let docs = crate::corpus::load_corpus(&path).expect("parse corpus");
        assert_eq!(docs.len() as u64, n, "generated corpus size mismatch");
        Self { docs }
    }
}

/// Build an index for a bench corpus into `out_dir`; returns the open index.
#[cfg(feature = "bench")]
pub fn build(bc: &BenchCorpus, out_dir: &std::path::Path) -> SearchIndex {
    build_index(&bc.docs, out_dir).expect("bench index must build");
    SearchIndex::open(out_dir).expect("bench index must open")
}

/// Run a search against an open index (bench hot path).
#[cfg(feature = "bench")]
pub fn search(idx: &SearchIndex, q: &str) -> (Vec<SearchHit>, usize) {
    index_search(idx, q, 20, None).expect("bench search must succeed")
}
