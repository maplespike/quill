//! Criterion benches for quill-search (issue #976).
//!
//! Measures index build throughput and query p50/p95 at 1k / 10k / 100k docs.
//! Corpora are generated deterministically by quill-search-bench-gen at bench
//! time (never committed). Run: `cargo bench -p quill-search`.

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use quill_search::bench_support::BenchCorpus;
use std::hint::black_box;

const SEED: u64 = 42;

fn corpus(dir: &std::path::Path, docs: u64) -> BenchCorpus {
    BenchCorpus::generate(dir, docs, SEED)
}

fn bench_index_build(c: &mut Criterion) {
    let tmp = tempfile::tempdir().expect("tempdir");
    let mut group = c.benchmark_group("index_build");
    for &docs in &[1_000u64, 10_000, 100_000] {
        let bench_corpus = corpus(&tmp.path().join(format!("corpus-{docs}")), docs);
        group.throughput(Throughput::Elements(docs));
        group.bench_with_input(
            BenchmarkId::new("build", format!("{docs}-docs")),
            &bench_corpus,
            |b, bc| {
                let out = tmp.path().join(format!("idx-{docs}"));
                b.iter(|| {
                    let out = out.join(format!("it-{}", std::process::id()));
                    quill_search::bench_support::build(bc, &out)
                })
            },
        );
    }
    group.finish();
}

fn bench_query(c: &mut Criterion) {
    let tmp = tempfile::tempdir().expect("tempdir");
    let mut group = c.benchmark_group("query");
    for &docs in &[1_000u64, 10_000, 100_000] {
        let bench_corpus = corpus(&tmp.path().join(format!("corpus-{docs}")), docs);
        let out = tmp.path().join(format!("idx-{docs}"));
        let index = quill_search::bench_support::build(&bench_corpus, &out);
        for query in ["bloor street", "council budget toronto", "water"] {
            group.bench_with_input(
                BenchmarkId::new(format!("{docs}-docs"), query),
                &(),
                |b, _| {
                    b.iter(|| {
                        let (hits, total) = quill_search::bench_support::search(
                            black_box(&index),
                            black_box(query),
                        );
                        black_box((hits, total));
                    })
                },
            );
        }
    }
    group.finish();
}

criterion_group!(benches, bench_index_build, bench_query);
criterion_main!(benches);
