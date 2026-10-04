//! Index build + open + query (issue #976).
//!
//! `build_index` writes a tantivy index to an empty/new directory and records
//! corpus metadata (doc count, kinds, build timestamp) in a sidecar
//! `quill-meta.json`, which `serve` reads for `/health` and `/stats` without
//! touching tantivy internals. The build is deterministic: documents are
//! written in corpus order.

use crate::corpus::Document;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;
use tantivy::collector::TopDocs;
use tantivy::doc;
use tantivy::query::QueryParser;
use tantivy::schema::{Field, Schema, Value, STORED, TEXT};
use tantivy::{Index, IndexReader, ReloadPolicy, TantivyDocument};

/// Sidecar metadata written next to the tantivy index at build time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexMeta {
    pub docs: u64,
    /// Per-kind document counts, e.g. {"municipal": 40, "module": 5}.
    pub kinds: BTreeMap<String, u64>,
    /// Build timestamp (RFC 3339, UTC).
    pub built_at: String,
}

pub const META_FILE: &str = "quill-meta.json";

/// Tantivy field registry for the corpus schema.
#[derive(Debug, Clone)]
pub struct SearchFields {
    pub id: Field,
    pub kind: Field,
    pub title: Field,
    pub text: Field,
    pub url: Field,
    pub source: Field,
    pub published: Field,
    pub updated: Field,
    pub meta: Field,
}

pub fn build_schema() -> (Schema, SearchFields) {
    let mut builder = Schema::builder();
    let id = builder.add_text_field("id", TEXT | STORED);
    let kind = builder.add_text_field("kind", TEXT | STORED);
    let title = builder.add_text_field("title", TEXT | STORED);
    let text = builder.add_text_field("text", TEXT | STORED);
    let url = builder.add_text_field("url", TEXT | STORED);
    let source = builder.add_text_field("source", TEXT | STORED);
    let published = builder.add_text_field("published", STORED);
    let updated = builder.add_text_field("updated", STORED);
    // Raw JSON string, stored only (not tokenized) — returned verbatim.
    let meta = builder.add_text_field("meta", STORED);
    (
        builder.build(),
        SearchFields {
            id,
            kind,
            title,
            text,
            url,
            source,
            published,
            updated,
            meta,
        },
    )
}

fn doc_to_tantivy(doc: &Document, fields: &SearchFields) -> TantivyDocument {
    let meta_str = if doc.meta.is_null() {
        "{}".to_string()
    } else {
        doc.meta.to_string()
    };
    tantivy::doc!(
        fields.id => doc.id.as_str(),
        fields.kind => doc.kind.as_str(),
        fields.title => doc.title.as_str(),
        fields.text => doc.text.as_str(),
        fields.url => doc.url.as_str(),
        fields.source => doc.source.as_str(),
        fields.published => doc.published.as_str(),
        fields.updated => doc.updated.as_str(),
        fields.meta => meta_str.as_str(),
    )
}

/// Build an index from parsed corpus documents into `out_dir`.
///
/// Determinism: docs are written in the corpus's own (line) order; tantivy
/// segments are finalized by commit. The sidecar meta file is written with
/// sorted keys (`BTreeMap` + `serde_json` preserves insertion order), so the
/// same corpus produces byte-identical `quill-meta.json`.
pub fn build_index(docs: &[Document], out_dir: &Path) -> Result<IndexMeta> {
    std::fs::create_dir_all(out_dir)
        .with_context(|| format!("cannot create index dir `{}`", out_dir.display()))?;

    let (schema, fields) = build_schema();
    let index = Index::create_in_dir(out_dir, schema)
        .with_context(|| format!("cannot create tantivy index in `{}`", out_dir.display()))?;
    let mut writer = index
        .writer(32 * 1024 * 1024)
        .context("cannot open tantivy index writer")?;

    for doc in docs {
        writer
            .add_document(doc_to_tantivy(doc, &fields))
            .with_context(|| format!("cannot add document `{}` to index", doc.id))?;
    }

    let (kind_counts, _) = docs.iter().fold((BTreeMap::new(), 0u64), |(mut m, n), d| {
        *m.entry(d.kind.clone()).or_insert(0) += 1;
        (m, n)
    });
    let built_at = now_rfc3339();
    let meta = IndexMeta {
        docs: docs.len() as u64,
        kinds: kind_counts,
        built_at,
    };

    writer.commit().context("tantivy commit failed")?;

    // Sidecar metadata for /health + /stats. Write after commit so the meta
    // file never describes a half-built index.
    let meta_path = out_dir.join(META_FILE);
    let meta_bytes = serde_json::to_vec_pretty(&meta).context("cannot serialize index meta")?;
    std::fs::write(&meta_path, meta_bytes)
        .with_context(|| format!("cannot write `{}`", meta_path.display()))?;

    Ok(meta)
}

/// The open index + reader serving queries.
#[derive(Clone)]
pub struct SearchIndex {
    pub index: Index,
    pub reader: IndexReader,
    pub fields: SearchFields,
    pub meta: IndexMeta,
    pub index_dir: std::path::PathBuf,
}

impl SearchIndex {
    /// Open a previously built index directory (tantivy files + sidecar meta).
    pub fn open(dir: &Path) -> Result<Self> {
        let index = Index::open_in_dir(dir)
            .with_context(|| format!("cannot open tantivy index at `{}`", dir.display()))?;
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::Manual)
            .try_into()
            .context("cannot open index reader")?;
        let (schema, fields) = build_schema();
        debug_assert_eq!(schema, index.schema());
        let meta_path = dir.join(META_FILE);
        let meta_bytes = std::fs::read(&meta_path)
            .with_context(|| format!("index dir `{}` is missing `{META_FILE}`", dir.display()))?;
        let meta: IndexMeta =
            serde_json::from_slice(&meta_bytes).context("cannot parse index meta")?;
        Ok(Self {
            index,
            reader,
            fields,
            meta,
            index_dir: dir.to_path_buf(),
        })
    }

    /// Byte size of the index directory (tantivy segments + sidecar meta).
    pub fn index_bytes(&self) -> u64 {
        dir_size(&self.index_dir)
    }
}

/// One ranked search result, as returned by the HTTP API.
#[derive(Debug, Clone, Serialize)]
pub struct SearchHit {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub text: String,
    pub url: String,
    pub source: String,
    pub published: String,
    pub updated: String,
    pub meta: serde_json::Value,
    pub snippet: String,
    pub score: f32,
}

/// Run a query. `kind` filters to one doc kind when non-empty.
pub fn search(
    idx: &SearchIndex,
    query_str: &str,
    limit: usize,
    kind: Option<&str>,
) -> Result<(Vec<SearchHit>, usize)> {
    let f = &idx.fields;
    let mut parser = QueryParser::for_index(&idx.index, vec![f.title, f.text]);
    parser.set_conjunction_by_default();
    let query = parser
        .parse_query(query_str)
        .map_err(|e| anyhow::anyhow!("invalid query: {e}"))?;

    // Overfetch so `total` is exact even when a kind filter drops hits,
    // then truncate to `limit` after filtering.
    let fetch = 1000usize.max(limit * 10);
    let top = idx
        .reader
        .searcher()
        .search(&query, &TopDocs::with_limit(fetch))
        .context("search execution failed")?;

    let mut hits = Vec::new();
    let mut total = 0usize;
    for (score, addr) in top {
        let doc = idx
            .reader
            .searcher()
            .doc::<TantivyDocument>(addr)
            .context("cannot retrieve document")?;
        let get = |field: Field| -> String {
            doc.get_first(field)
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string()
        };
        let doc_kind = get(f.kind);
        if let Some(k) = kind {
            if doc_kind != k {
                continue;
            }
        }
        total += 1;
        if hits.len() >= limit {
            continue;
        }
        let id = get(f.id);
        let kind = get(f.kind);
        let title = get(f.title);
        let text = get(f.text);
        let url = get(f.url);
        let source = get(f.source);
        let published = get(f.published);
        let updated = get(f.updated);
        let meta_str = get(f.meta);
        let meta: serde_json::Value = serde_json::from_str(&meta_str).unwrap_or_default();
        let snippet = snippet_for(idx, &doc, f.text, &title, &query);
        hits.push(SearchHit {
            id,
            kind,
            title,
            text,
            url,
            source,
            published,
            updated,
            meta,
            snippet,
            score,
        });
    }
    Ok((hits, total))
}

/// Build an HTML-safe plaintext snippet around the first match in `text`.
fn snippet_for(
    idx: &SearchIndex,
    doc: &TantivyDocument,
    text_field: Field,
    title: &str,
    query: &dyn tantivy::query::Query,
) -> String {
    let searcher = idx.reader.searcher();
    let snip_generator = tantivy::snippet::SnippetGenerator::create(&searcher, query, text_field);
    match snip_generator {
        Ok(gen) => {
            let text = doc
                .get_first(text_field)
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let snip = gen.snippet_from_doc(doc);
            // tantivy highlights ranges are indices into the fragment.
            let html = snip.to_html();
            if html.is_empty() {
                fallback_snippet(title, text)
            } else {
                html
            }
        }
        Err(_) => title.to_string(),
    }
}

fn fallback_snippet(title: &str, text: &str) -> String {
    let trimmed: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let cut = trimmed
        .char_indices()
        .take(160)
        .last()
        .map(|(i, c)| i + c.len_utf8())
        .unwrap_or(0);
    let mut s = trimmed[..cut.min(trimmed.len())].to_string();
    if cut < trimmed.len() {
        s.push('…');
    }
    if s.is_empty() {
        s = title.to_string();
    }
    s
}

/// RFC 3339 UTC timestamp for the current time.
pub fn now_rfc3339() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let (y, mo, d) = civil_from_days(days as i64);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{m:02}:{s:02}Z")
}

/// Days-since-epoch → civil date (Howard Hinnant's algorithm).
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

fn dir_size(dir: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                total += entry.metadata().map(|m| m.len()).unwrap_or(0);
            } else if path.is_dir() {
                total += dir_size(&path);
            }
        }
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::corpus::parse_corpus;

    fn fixture_docs() -> Vec<Document> {
        let corpus = r#"
{"id":"toronto:contracts:1","kind":"municipal","title":"Construction contract 2026-001","text":"The City of Toronto awarded a construction contract for road repairs on Bloor Street.","url":"https://toronto.ca/contracts/1","source":"city of toronto","published":"2026-01-05","updated":"","meta":{"dataset":"contracts"}}
{"id":"toronto:contracts:2","kind":"municipal","title":"Road maintenance agreement","text":"Road maintenance agreement covering Bloor Street and Danforth Avenue.","url":"https://toronto.ca/contracts/2","source":"city of toronto","published":"2026-02-01","updated":"","meta":{}}
{"id":"module:rss","kind":"module","title":"RSS core module","text":"Ingests federal RSS news feeds for press releases and announcements.","url":"https://quill.maplespike.ca","source":"registry","published":"","updated":"","meta":{"category":"rss"}}
"#;
        parse_corpus(corpus.as_bytes()).unwrap()
    }

    #[test]
    fn build_and_open_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let docs = fixture_docs();
        let meta = build_index(&docs, dir.path()).unwrap();
        assert_eq!(meta.docs, 3);
        assert_eq!(meta.kinds.get("municipal"), Some(&2));
        assert_eq!(meta.kinds.get("module"), Some(&1));

        let idx = SearchIndex::open(dir.path()).unwrap();
        assert_eq!(idx.meta.docs, 3);
        assert!(idx.index_bytes() > 0);
    }

    #[test]
    fn search_ranks_and_filters() {
        let dir = tempfile::tempdir().unwrap();
        let docs = fixture_docs();
        build_index(&docs, dir.path()).unwrap();
        let idx = SearchIndex::open(dir.path()).unwrap();

        // Both docs contain "bloor street"; BM25 length-normalization lets the
        // shorter doc (contracts:2) outrank, so only membership is pinned here.
        // Distinctive-term ordering is pinned by the query below and by the
        // integration test (PINNED_QUERY → PINNED_TOP_HIT).
        let (hits, total) = search(&idx, "bloor street", 10, None).unwrap();
        assert_eq!(total, 2);
        assert_eq!(hits.len(), 2);
        let ids: Vec<&str> = hits.iter().map(|h| h.id.as_str()).collect();
        assert!(ids.contains(&"toronto:contracts:1"), "ids: {ids:?}");
        assert!(ids.contains(&"toronto:contracts:2"), "ids: {ids:?}");

        // Terms only contracts:1 has rank it first (conjunction default).
        let (hits, total) = search(&idx, "bloor street construction", 10, None).unwrap();
        assert_eq!(total, 1);
        assert_eq!(hits[0].id, "toronto:contracts:1");

        let (hits, total) = search(&idx, "bloor street", 10, Some("module")).unwrap();
        assert_eq!(total, 0);
        assert!(hits.is_empty());

        let (hits, total) = search(&idx, "module", 10, Some("module")).unwrap();
        assert_eq!(total, 1);
        assert_eq!(hits[0].id, "module:rss");
        assert!(!hits[0].snippet.is_empty());
    }

    #[test]
    fn limit_truncates_but_total_counts_all() {
        let dir = tempfile::tempdir().unwrap();
        let docs = fixture_docs();
        build_index(&docs, dir.path()).unwrap();
        let idx = SearchIndex::open(dir.path()).unwrap();
        let (hits, total) = search(&idx, "road", 1, None).unwrap();
        assert_eq!(hits.len(), 1);
        assert!(total >= 1);
    }

    #[test]
    fn rfc3339_is_well_formed() {
        let ts = now_rfc3339();
        assert_eq!(ts.len(), 20);
        assert!(ts.ends_with('Z'));
        assert_eq!(&ts[4..5], "-");
        assert_eq!(&ts[10..11], "T");
    }
}
