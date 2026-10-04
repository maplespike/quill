//! Quill search corpus model (issue #976).
//!
//! The corpus contract is JSONL: one document per line, fields
//! `id`, `kind`, `title`, `text`, `url`, `source`, `published`, `updated`,
//! `meta`. Producers: `scripts/export-search-corpus.mts` (municipal cache +
//! module registry) and `crates/quill-search-bench-gen` (deterministic bench
//! corpora).

use serde::{Deserialize, Serialize};
use std::path::Path;

/// One searchable document.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Document {
    pub id: String,
    /// Doc kind: `municipal` (one cached record) or `module` (registry entry).
    pub kind: String,
    pub title: String,
    pub text: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub published: String,
    #[serde(default)]
    pub updated: String,
    #[serde(default)]
    pub meta: serde_json::Value,
}

impl Document {
    /// Validate the fields the index and search path rely on.
    pub fn validate(&self, line_no: usize) -> Result<(), CorpusError> {
        for (field, value) in [
            ("id", &self.id),
            ("kind", &self.kind),
            ("title", &self.title),
            ("text", &self.text),
        ] {
            if value.trim().is_empty() {
                return Err(CorpusError::MissingField {
                    line_no,
                    field: field.to_string(),
                });
            }
        }
        Ok(())
    }
}

/// Corpus parse/validation failures. Every variant names the offending line so
/// a bad corpus fails loud instead of silently dropping documents.
#[derive(Debug, thiserror::Error)]
pub enum CorpusError {
    #[error("corpus line {line_no}: not valid JSON ({source})")]
    InvalidJson {
        line_no: usize,
        source: serde_json::Error,
    },
    #[error("corpus line {line_no}: missing or empty required field `{field}`")]
    MissingField { line_no: usize, field: String },
    #[error("corpus line {line_no}: {message}")]
    Custom { line_no: usize, message: String },
}

impl CorpusError {
    pub fn line_no(&self) -> usize {
        match self {
            CorpusError::InvalidJson { line_no, .. }
            | CorpusError::MissingField { line_no, .. }
            | CorpusError::Custom { line_no, .. } => *line_no,
        }
    }
}

/// Parse a JSONL corpus. Lines are numbered from 1; blank lines are skipped.
pub fn parse_corpus(bytes: &[u8]) -> Result<Vec<Document>, CorpusError> {
    let content = std::str::from_utf8(bytes).map_err(|e| CorpusError::Custom {
        line_no: 0,
        message: format!("corpus is not valid UTF-8: {e}"),
    })?;
    let mut docs = Vec::new();
    for (idx, line) in content.lines().enumerate() {
        let line_no = idx + 1;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let doc: Document = serde_json::from_str(trimmed)
            .map_err(|source| CorpusError::InvalidJson { line_no, source })?;
        doc.validate(line_no)?;
        docs.push(doc);
    }
    Ok(docs)
}

/// Read + parse a corpus file from disk.
pub fn load_corpus(path: &Path) -> Result<Vec<Document>, CorpusError> {
    let bytes = std::fs::read(path).map_err(|e| CorpusError::Custom {
        line_no: 0,
        message: format!("cannot read corpus `{}`: {e}", path.display()),
    })?;
    parse_corpus(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc_json(id: &str, kind: &str, title: &str, text: &str) -> String {
        serde_json::json!({
            "id": id, "kind": kind, "title": title, "text": text,
            "url": "https://example.test", "source": "test", "meta": {}
        })
        .to_string()
    }

    #[test]
    fn parses_valid_lines_and_skips_blanks() {
        let corpus = format!(
            "{}\n\n{}\n",
            doc_json("a", "module", "Alpha", "alpha body"),
            doc_json("b", "municipal", "Beta", "beta body")
        );
        let docs = parse_corpus(corpus.as_bytes()).unwrap();
        assert_eq!(docs.len(), 2);
        assert_eq!(docs[0].id, "a");
        assert_eq!(docs[1].kind, "municipal");
    }

    #[test]
    fn invalid_json_names_the_line() {
        let corpus = format!(
            "{}\n{{not json}}\n",
            doc_json("a", "module", "Alpha", "alpha body")
        );
        let err = parse_corpus(corpus.as_bytes()).unwrap_err();
        assert_eq!(err.line_no(), 2);
        assert!(err.to_string().contains("line 2"));
    }

    #[test]
    fn missing_field_names_line_and_field() {
        let bad = r#"{"id":"a","kind":"module","title":"","text":"x"}"#;
        let err = parse_corpus(bad.as_bytes()).unwrap_err();
        assert_eq!(err.line_no(), 1);
        assert!(err.to_string().contains("title"));
    }

    #[test]
    fn defaults_absent_optional_fields() {
        let doc: Document =
            serde_json::from_str(r#"{"id":"a","kind":"module","title":"T","text":"B"}"#).unwrap();
        assert_eq!(doc.url, "");
        assert_eq!(doc.meta, serde_json::json!({}));
    }
}
