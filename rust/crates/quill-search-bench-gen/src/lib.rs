//! Deterministic bench-corpus generator library (issue #976).
//!
//! Emits JSONL corpora for the criterion benches and the Node baseline
//! script at 1k / 10k / 100k docs. Fully deterministic: seeded xorshift64*
//! PRNG, fixed word lists, no clock dependence. Same seed → same corpus,
//! byte for byte, so the Rust bench and the Node baseline measure the
//! exact same documents.

use anyhow::Result;
use serde_json::json;
use std::io::{BufWriter, Write};
use std::path::PathBuf;

/// Deterministic xorshift64* — same seed, same sequence.
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Self(seed.wrapping_mul(0x9E3779B97F4A7C15) | 1)
    }
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        x.wrapping_mul(0x2545F4914F6CDD1D)
    }
    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }
}

/// Deterministic PRNG shuffle (Fisher–Yates).
pub fn shuffle<T>(items: &mut [T], rng: &mut Rng) {
    let n = items.len() as u64;
    for i in (1..n).rev() {
        let j = rng.below(i + 1);
        items.swap(i as usize, j as usize);
    }
}

pub const SUBJECTS: &[&str] = &[
    "road",
    "water",
    "transit",
    "budget",
    "council",
    "zoning",
    "contract",
    "permit",
    "audit",
    "school",
    "library",
    "park",
    "emergency",
    "housing",
    "transparency",
    "procurement",
    "sanitation",
    "energy",
    "climate",
    "transit-fares",
];
pub const VERBS: &[&str] = &[
    "awarded",
    "approved",
    "reviewed",
    "published",
    "deferred",
    "amended",
    "tendered",
    "cancelled",
    "extended",
    "noted",
];
pub const PLACES: &[&str] = &[
    "Bloor Street",
    "Danforth Avenue",
    "Yonge Street",
    "Queen Street",
    "King Street",
    "Dundas Street",
    "College Street",
    "Eglinton Avenue",
    "Finch Avenue",
    "Sheppard Avenue",
    "Bay Street",
    "Front Street",
    "Bathurst Street",
    "Ossington Avenue",
    "Dufferin Street",
    "Keele Street",
];
pub const REGIONS: &[&str] = &[
    "Toronto",
    "Mississauga",
    "Vancouver",
    "Calgary",
    "Edmonton",
    "Ottawa",
    "Hamilton",
    "Brampton",
    "Winnipeg",
    "Halifax",
    "Victoria",
    "Saskatoon",
];

/// One generated document line. Shape mirrors the exporter output so both the
/// Rust benches and the Node baseline consume identical corpora.
pub fn doc_line(n: u64, rng: &mut Rng) -> String {
    let place = PLACES[rng.below(PLACES.len() as u64) as usize];
    let subject = SUBJECTS[rng.below(SUBJECTS.len() as u64) as usize];
    let verb = VERBS[rng.below(VERBS.len() as u64) as usize];
    let region = REGIONS[rng.below(REGIONS.len() as u64) as usize];
    let kind = if n.is_multiple_of(5) {
        "module"
    } else {
        "municipal"
    };

    let title = if kind == "municipal" {
        format!("{region} {subject} record {n}")
    } else {
        format!("{region} {subject} module {n}")
    };
    let text = format!(
        "The {region} council {verb} a {subject} measure concerning {place}. \
         Public consultation on the {subject} file for {place} is recorded in \
         the municipal register under docket {n}."
    );
    let doc = json!({
        "id": format!("{region}:bench:{n}"),
        "kind": kind,
        "title": title,
        "text": text,
        "url": format!("https://example.test/bench/{n}"),
        "source": format!("city of {region}"),
        "published": "2026-01-01",
        "updated": "",
        "meta": { "docket": n, "place": place, "subject": subject },
    });
    doc.to_string()
}

/// Generate `n` documents as JSONL lines, deterministic under `seed`.
pub fn generate_lines(n: u64, seed: u64) -> Vec<String> {
    let mut rng = Rng::new(seed);
    let mut lines: Vec<String> = (0..n).map(|i| doc_line(i, &mut rng)).collect();
    // Shuffle so relevance structure does not correlate with id order.
    shuffle(&mut lines, &mut Rng::new(seed ^ 0xdead_beef));
    lines
}

/// Write `n` generated docs to `out` as JSONL. Returns the doc count.
pub fn generate_to(out: &PathBuf, n: u64, seed: u64) -> Result<u64> {
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let file = std::fs::File::create(out)?;
    let mut w = BufWriter::new(file);
    for line in generate_lines(n, seed) {
        writeln!(w, "{line}")?;
    }
    w.flush()?;
    Ok(n)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_across_runs() {
        let a = generate_lines(50, 42);
        let b = generate_lines(50, 42);
        assert_eq!(a, b);
        assert_eq!(a.len(), 50);
    }

    #[test]
    fn seeds_differ() {
        let a = generate_lines(50, 42);
        let b = generate_lines(50, 43);
        assert_ne!(a, b);
    }

    #[test]
    fn lines_are_valid_corpus_json() {
        let corpus = generate_lines(10, 7).join("\n");
        let lines: Vec<_> = corpus
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| serde_json::from_str::<serde_json::Value>(l).unwrap())
            .collect();
        assert_eq!(lines.len(), 10);
    }

    #[test]
    fn generated_files_are_identical() {
        let dir = tempfile_dir();
        let p1 = dir.join("a.jsonl");
        let p2 = dir.join("b.jsonl");
        generate_to(&p1, 100, 42).unwrap();
        generate_to(&p2, 100, 42).unwrap();
        assert_eq!(std::fs::read(&p1).unwrap(), std::fs::read(&p2).unwrap());
    }

    fn tempfile_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "quill-bench-gen-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }
}
