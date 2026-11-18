//! Index build + open + query (issue #976).
//!
//! `build_index` writes a tantivy index to an empty/new directory and records
//! corpus metadata (doc count, kinds, build timestamp) in a sidecar
//! `quill-meta.json`, which `serve` reads for `/health` and `/stats` without
//! touching tantivy internals. The sidecar is written after the tantivy
//! commit, atomically, on every build. `prepare_startup` refuses to serve a
//! missing index, a missing sidecar, or an index no larger than the committed
//! sample corpus, except the one-document bootstrap placeholder written when
//! `search.bootstrapEmptyIndex` is enabled. The build is deterministic apart from `built_at`: documents
//! are written in corpus order.

use crate::corpus::Document;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::Write;
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

/// Document count of `rust/fixtures/sample.jsonl`.
///
/// A serve process that reports this count is serving the sample corpus, not
/// a production build. `prepare_startup` treats that size as too small.
pub const FIXTURE_DOC_COUNT: u64 = 30;

/// Smallest index `quill-search serve` will publish unless `--min-docs 0`.
pub const MIN_PRODUCTION_DOCS: u64 = FIXTURE_DOC_COUNT + 1;

/// Document id written by the chart's bootstrap-empty-index init container.
/// A fresh index claim starts with this one placeholder so `serve` can bind
/// before the first ingest. `prepare_startup` exempts that index from the
/// min-docs floor. The next corpus build replaces it.
pub const BOOTSTRAP_DOC_ID: &str = "quill:search:bootstrap";

/// Options for the check `serve` runs before it binds a port.
#[derive(Debug, Clone, Copy)]
pub struct StartupOptions<'a> {
    /// Refuse an index with fewer docs. `0` disables the floor.
    pub min_docs: u64,
    /// When the current index is unusable, rebuild from this JSONL corpus.
    pub corpus: Option<&'a Path>,
}

/// What `prepare_startup` did to the index directory.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StartupOutcome {
    /// The directory already had a usable index and sidecar.
    Ready { docs: u64 },
    /// The directory was rebuilt from the supplied corpus.
    Rebuilt { docs: u64 },
}

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
    // Drop the writer before the sidecar write so the commit's file set is
    // finished. The sidecar is not a tantivy file. Write it after commit so
    // it never describes a half-built index, and so a later open still finds it.
    drop(writer);
    write_index_meta(out_dir, &meta)?;

    Ok(meta)
}

/// Write `quill-meta.json` next to a finished index.
///
/// The write is atomic (temp file, fsync, rename). A crash leaves either the
/// previous sidecar or no sidecar. It does not leave a partial JSON file
/// under the name `serve` reads.
fn write_index_meta(out_dir: &Path, meta: &IndexMeta) -> Result<()> {
    let final_path = out_dir.join(META_FILE);
    let tmp_path = out_dir.join(format!(".{META_FILE}.tmp"));
    let bytes = serde_json::to_vec_pretty(meta).context("cannot serialize index meta")?;
    {
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&tmp_path)
            .with_context(|| format!("cannot open `{}`", tmp_path.display()))?;
        file.write_all(&bytes)
            .with_context(|| format!("cannot write `{}`", tmp_path.display()))?;
        file.write_all(b"\n")
            .with_context(|| format!("cannot write `{}`", tmp_path.display()))?;
        file.sync_all()
            .with_context(|| format!("cannot flush `{}`", tmp_path.display()))?;
    }
    std::fs::rename(&tmp_path, &final_path)
        .with_context(|| format!("cannot publish `{META_FILE}` at `{}`", final_path.display()))?;
    if !final_path.is_file() {
        anyhow::bail!(
            "index build did not leave `{META_FILE}` at `{}`",
            final_path.display()
        );
    }
    Ok(())
}

/// Decide whether `index_dir` is safe to serve.
///
/// A missing directory, a missing or unreadable `quill-meta.json`, a tantivy
/// directory that will not open, or a doc count below `min_docs` is a refusal.
/// When `corpus` is set, the function rebuilds the directory from that corpus
/// and applies the same check to the result. It does not bind a port.
pub fn prepare_startup(index_dir: &Path, opts: StartupOptions<'_>) -> Result<StartupOutcome> {
    let problem = match classify_index(index_dir, opts.min_docs) {
        Ok(meta) => return Ok(StartupOutcome::Ready { docs: meta.docs }),
        Err(problem) => problem,
    };
    let Some(corpus) = opts.corpus else {
        return Err(refusal(problem, index_dir));
    };
    let docs = crate::corpus::load_corpus(corpus).map_err(|e| {
        refusal(
            format!("cannot rebuild from `{}`: {e}", corpus.display()),
            index_dir,
        )
    })?;
    if docs.is_empty() {
        return Err(refusal(
            format!("corpus `{}` contains no documents", corpus.display()),
            index_dir,
        ));
    }
    replace_index(&docs, index_dir)
        .map_err(|e| refusal(format!("rebuild failed: {e:#}"), index_dir))?;
    match classify_index(index_dir, opts.min_docs) {
        Ok(meta) => Ok(StartupOutcome::Rebuilt { docs: meta.docs }),
        Err(again) => Err(refusal(
            format!(
                "rebuilt from `{}` and the index is still unusable: {again}",
                corpus.display()
            ),
            index_dir,
        )),
    }
}

fn classify_index(dir: &Path, min_docs: u64) -> std::result::Result<IndexMeta, String> {
    if !dir.is_dir() {
        return Err(format!(
            "index directory `{}` does not exist",
            dir.display()
        ));
    }
    let meta_path = dir.join(META_FILE);
    if !meta_path.is_file() {
        return Err(missing_meta_detail(dir));
    }
    let meta_bytes = std::fs::read(&meta_path)
        .map_err(|e| format!("cannot read `{}`: {e}", meta_path.display()))?;
    let meta: IndexMeta = serde_json::from_slice(&meta_bytes)
        .map_err(|e| format!("cannot parse `{}`: {e}", meta_path.display()))?;
    if let Err(e) = Index::open_in_dir(dir) {
        return Err(format!(
            "cannot open the tantivy index at `{}`: {e}",
            dir.display()
        ));
    }
    if min_docs > 0 && meta.docs < min_docs {
        if is_bootstrap_placeholder(dir, &meta) {
            return Ok(meta);
        }
        return Err(format!(
            "index at `{}` is undersized: {} docs, minimum is {min_docs}. The sample corpus rust/fixtures/sample.jsonl has {FIXTURE_DOC_COUNT} docs. A production index must be larger than that sample.",
            dir.display(),
            meta.docs
        ));
    }
    Ok(meta)
}

/// True when `dir` is the one-document bootstrap index (#1346), not a
/// sample-sized or otherwise undersized corpus.
fn is_bootstrap_placeholder(dir: &Path, meta: &IndexMeta) -> bool {
    if meta.docs != 1 {
        return false;
    }
    let Ok(idx) = SearchIndex::open(dir) else {
        return false;
    };
    index_contains_id(&idx, BOOTSTRAP_DOC_ID)
}

fn index_contains_id(idx: &SearchIndex, id: &str) -> bool {
    // The id field is tokenized TEXT, so a Term query on the raw
    // "quill:search:bootstrap" string does not match. Read the stored id
    // of the single document instead.
    let searcher = idx.reader.searcher();
    let Ok(top) = searcher.search(
        &tantivy::query::AllQuery,
        &TopDocs::with_limit(1).order_by_score(),
    ) else {
        return false;
    };
    let Some((_score, addr)) = top.first() else {
        return false;
    };
    let Ok(doc) = searcher.doc::<TantivyDocument>(*addr) else {
        return false;
    };
    doc.get_first(idx.fields.id)
        .and_then(|v| v.as_str())
        .map(|stored| stored == id)
        .unwrap_or(false)
}

fn missing_meta_detail(dir: &Path) -> String {
    match Index::open_in_dir(dir) {
        Ok(_) => format!(
            "index directory `{}` has a tantivy index but `{META_FILE}` is missing. An index build must write this sidecar before serve starts.",
            dir.display()
        ),
        Err(_) => format!(
            "index directory `{}` is missing `{META_FILE}`",
            dir.display()
        ),
    }
}

fn refusal(detail: String, index_dir: &Path) -> anyhow::Error {
    let mut msg = format!("refusing to serve: {detail}");
    if let Some(note) = parent_sidecar_note(index_dir) {
        msg.push(' ');
        msg.push_str(&note);
    }
    msg.push_str(
        " Rebuild with `quill-search index --corpus <jsonl> --out <index-dir>`, or start serve with `--corpus` so this process rebuilds before it listens. Steps: docs/runbooks/search-reindex.md.",
    );
    anyhow::anyhow!(msg)
}

/// The volume used to be mounted at the index path, so the real sidecar can
/// sit on the claim root, one directory above the path serve opens now.
fn parent_sidecar_note(index_dir: &Path) -> Option<String> {
    let parent = index_dir.parent()?;
    if parent.as_os_str().is_empty() {
        return None;
    }
    let path = parent.join(META_FILE);
    if !path.is_file() {
        return None;
    }
    let docs = std::fs::read(&path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<IndexMeta>(&bytes).ok())
        .map(|meta| meta.docs);
    Some(match docs {
        Some(n) => format!(
            "A sidecar is at `{}` and reports {n} docs. That path is the claim root. This process and the search backup both read `{}`. The volume used to be mounted at the index path, so the real files can sit one level up.",
            path.display(),
            index_dir.join(META_FILE).display()
        ),
        None => format!(
            "A file exists at `{}` but it is not a readable sidecar. This process reads `{}`.",
            path.display(),
            index_dir.join(META_FILE).display()
        ),
    })
}

/// Build `docs` into a sibling directory, then swap it into `out_dir`.
fn replace_index(docs: &[Document], out_dir: &Path) -> Result<IndexMeta> {
    let parent = match out_dir.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent.to_path_buf(),
        _ => std::path::PathBuf::from("."),
    };
    std::fs::create_dir_all(&parent)
        .with_context(|| format!("cannot create `{}`", parent.display()))?;
    let name = out_dir
        .file_name()
        .context("index path has no directory name")?;
    let tmp = parent.join(format!(".{}.reindex", name.to_string_lossy()));
    let trash = parent.join(format!(".{}.replaced", name.to_string_lossy()));
    if tmp.exists() {
        std::fs::remove_dir_all(&tmp)
            .with_context(|| format!("cannot remove stale rebuild dir `{}`", tmp.display()))?;
    }
    let meta = build_index(docs, &tmp)?;
    let published = tmp.join(META_FILE);
    if !published.is_file() {
        anyhow::bail!(
            "index build did not write `{META_FILE}` in `{}`",
            tmp.display()
        );
    }
    if trash.exists() {
        std::fs::remove_dir_all(&trash)
            .with_context(|| format!("cannot remove `{}`", trash.display()))?;
    }
    if out_dir.exists() {
        std::fs::rename(out_dir, &trash).with_context(|| {
            format!(
                "cannot move `{}` aside to `{}`",
                out_dir.display(),
                trash.display()
            )
        })?;
    }
    if let Err(err) = std::fs::rename(&tmp, out_dir) {
        if trash.exists() && !out_dir.exists() {
            let _ = std::fs::rename(&trash, out_dir);
        }
        return Err(err).with_context(|| {
            format!(
                "cannot move rebuilt index `{}` to `{}`",
                tmp.display(),
                out_dir.display()
            )
        });
    }
    let _ = std::fs::remove_dir_all(&trash);
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
        .search(&query, &TopDocs::with_limit(fetch).order_by_score())
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

    #[test]
    fn fixture_corpus_is_the_thirty_doc_sample() {
        assert_eq!(FIXTURE_DOC_COUNT, 30);
        assert_eq!(
            crate::fixture::load_fixture().len() as u64,
            FIXTURE_DOC_COUNT
        );
        assert_eq!(MIN_PRODUCTION_DOCS, FIXTURE_DOC_COUNT + 1);
    }

    #[test]
    fn build_writes_quill_meta_json() {
        let dir = tempfile::tempdir().unwrap();
        let docs = fixture_docs();
        let meta = build_index(&docs, dir.path()).unwrap();
        let meta_path = dir.path().join(META_FILE);
        assert!(meta_path.is_file(), "build must leave {META_FILE}");
        assert!(
            !dir.path().join(format!(".{META_FILE}.tmp")).exists(),
            "temp sidecar must not remain"
        );
        let on_disk: IndexMeta =
            serde_json::from_slice(&std::fs::read(&meta_path).unwrap()).unwrap();
        assert_eq!(on_disk.docs, meta.docs);
        assert_eq!(on_disk.docs, docs.len() as u64);
        assert_eq!(on_disk.kinds, meta.kinds);
        assert_eq!(on_disk.built_at, meta.built_at);
    }

    fn corpus_file(dir: &Path, name: &str, docs: &[Document]) -> std::path::PathBuf {
        let path = dir.join(name);
        let lines = docs
            .iter()
            .map(|doc| serde_json::to_string(doc).unwrap())
            .collect::<Vec<_>>()
            .join("\n");
        std::fs::write(&path, format!("{lines}\n")).unwrap();
        path
    }

    #[test]
    fn startup_refuses_missing_index_missing_meta_and_undersized() {
        let root = tempfile::tempdir().unwrap();
        let missing = root.path().join("missing");
        let err = prepare_startup(
            &missing,
            StartupOptions {
                min_docs: MIN_PRODUCTION_DOCS,
                corpus: None,
            },
        )
        .unwrap_err()
        .to_string();
        assert!(err.contains("refusing to serve"), "{err}");
        assert!(err.contains("does not exist"), "{err}");
        assert!(err.contains("docs/runbooks/search-reindex.md"), "{err}");

        let built = root.path().join("built");
        build_index(&fixture_docs(), &built).unwrap();
        std::fs::remove_file(built.join(META_FILE)).unwrap();
        let err = prepare_startup(
            &built,
            StartupOptions {
                min_docs: MIN_PRODUCTION_DOCS,
                corpus: None,
            },
        )
        .unwrap_err()
        .to_string();
        assert!(err.contains("refusing to serve"), "{err}");
        assert!(err.contains(META_FILE), "{err}");
        assert!(
            err.contains("has a tantivy index"),
            "a tantivy dir without the sidecar must be named: {err}"
        );

        let small = root.path().join("small");
        build_index(&fixture_docs(), &small).unwrap();
        let err = prepare_startup(
            &small,
            StartupOptions {
                min_docs: MIN_PRODUCTION_DOCS,
                corpus: None,
            },
        )
        .unwrap_err()
        .to_string();
        assert!(err.contains("refusing to serve"), "{err}");
        assert!(err.contains("undersized"), "{err}");
        assert!(err.contains("3 docs"), "{err}");
        assert!(err.contains(&MIN_PRODUCTION_DOCS.to_string()), "{err}");
    }

    #[test]
    fn startup_names_a_claim_root_sidecar() {
        let root = tempfile::tempdir().unwrap();
        let index = root.path().join("index");
        std::fs::create_dir_all(&index).unwrap();
        let parent_meta = IndexMeta {
            docs: 100,
            kinds: BTreeMap::new(),
            built_at: "2026-11-01T00:00:00Z".to_string(),
        };
        std::fs::write(
            root.path().join(META_FILE),
            serde_json::to_vec_pretty(&parent_meta).unwrap(),
        )
        .unwrap();
        let err = prepare_startup(
            &index,
            StartupOptions {
                min_docs: MIN_PRODUCTION_DOCS,
                corpus: None,
            },
        )
        .unwrap_err()
        .to_string();
        assert!(err.contains("refusing to serve"), "{err}");
        assert!(err.contains("claim root"), "{err}");
        assert!(err.contains("100 docs"), "{err}");
        assert!(
            err.contains(&index.join(META_FILE).display().to_string()),
            "{err}"
        );
    }

    #[test]
    fn startup_rebuilds_from_corpus_and_writes_meta() {
        let root = tempfile::tempdir().unwrap();
        let index = root.path().join("index");
        let corpus = corpus_file(root.path(), "corpus.jsonl", &fixture_docs());
        let outcome = prepare_startup(
            &index,
            StartupOptions {
                min_docs: 1,
                corpus: Some(&corpus),
            },
        )
        .unwrap();
        assert_eq!(outcome, StartupOutcome::Rebuilt { docs: 3 });
        let meta_path = index.join(META_FILE);
        assert!(meta_path.is_file(), "rebuild must write {META_FILE}");
        let on_disk: IndexMeta =
            serde_json::from_slice(&std::fs::read(&meta_path).unwrap()).unwrap();
        assert_eq!(on_disk.docs, 3);
        let opened = SearchIndex::open(&index).unwrap();
        assert_eq!(opened.meta.docs, 3);
    }

    #[test]
    fn startup_keeps_a_usable_index_when_a_corpus_is_also_set() {
        let root = tempfile::tempdir().unwrap();
        let index = root.path().join("index");
        let meta = build_index(&fixture_docs(), &index).unwrap();
        let mut other = fixture_docs();
        other.pop();
        let corpus = corpus_file(root.path(), "other.jsonl", &other);
        let outcome = prepare_startup(
            &index,
            StartupOptions {
                min_docs: 1,
                corpus: Some(&corpus),
            },
        )
        .unwrap();
        assert_eq!(outcome, StartupOutcome::Ready { docs: 3 });
        let on_disk: IndexMeta =
            serde_json::from_slice(&std::fs::read(index.join(META_FILE)).unwrap()).unwrap();
        assert_eq!(on_disk.built_at, meta.built_at);
        assert_eq!(on_disk.docs, 3);
    }

    #[test]
    fn startup_refuses_a_rebuild_that_stays_undersized() {
        let root = tempfile::tempdir().unwrap();
        let index = root.path().join("index");
        let corpus = corpus_file(root.path(), "corpus.jsonl", &fixture_docs());
        let err = prepare_startup(
            &index,
            StartupOptions {
                min_docs: MIN_PRODUCTION_DOCS,
                corpus: Some(&corpus),
            },
        )
        .unwrap_err()
        .to_string();
        assert!(err.contains("refusing to serve"), "{err}");
        assert!(err.contains("still unusable"), "{err}");
        assert!(err.contains("undersized"), "{err}");
        assert!(
            index.join(META_FILE).is_file(),
            "the rebuilt sidecar stays on disk for inspection"
        );
    }

    fn bootstrap_docs() -> Vec<Document> {
        let corpus = r#"
{"id":"quill:search:bootstrap","kind":"system","title":"Search index bootstrap","text":"Placeholder written because the index claim mounted empty. Replaced by the next corpus build.","url":"","source":"quill-search","published":"","updated":"","meta":{}}
"#;
        parse_corpus(corpus.as_bytes()).unwrap()
    }

    #[test]
    fn startup_accepts_the_one_document_bootstrap_index() {
        let root = tempfile::tempdir().unwrap();
        let index = root.path().join("index");
        let meta = build_index(&bootstrap_docs(), &index).unwrap();
        assert_eq!(meta.docs, 1);
        let outcome = prepare_startup(
            &index,
            StartupOptions {
                min_docs: MIN_PRODUCTION_DOCS,
                corpus: None,
            },
        )
        .unwrap();
        assert_eq!(outcome, StartupOutcome::Ready { docs: 1 });
    }

    #[test]
    fn startup_still_refuses_a_one_document_index_without_the_bootstrap_marker() {
        let root = tempfile::tempdir().unwrap();
        let index = root.path().join("index");
        let one = fixture_docs().into_iter().take(1).collect::<Vec<_>>();
        build_index(&one, &index).unwrap();
        let err = prepare_startup(
            &index,
            StartupOptions {
                min_docs: MIN_PRODUCTION_DOCS,
                corpus: None,
            },
        )
        .unwrap_err()
        .to_string();
        assert!(err.contains("refusing to serve"), "{err}");
        assert!(err.contains("undersized"), "{err}");
        assert!(err.contains("1 docs"), "{err}");
    }
}
