//! quill-search — Quill's full-text search service (first Rust seam, #976).
//!
//! Two subcommands:
//!   quill-search index --corpus <jsonl> --out <dir>
//!   quill-search serve --index <dir> --port <n> --metrics-port <n>

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;

use quill_search::{corpus, index, serve};

#[derive(Parser)]
#[command(
    name = "quill-search",
    version,
    about = "Quill full-text search service (tantivy) — issue #976"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Build a tantivy index from a JSONL corpus into an output directory.
    Index {
        /// Path to the JSONL corpus (one document per line).
        #[arg(long)]
        corpus: PathBuf,
        /// Output directory for the index. Created if missing.
        #[arg(long)]
        out: PathBuf,
    },
    /// Serve search queries over HTTP from a built index directory.
    Serve {
        /// Directory of a previously built index.
        #[arg(long)]
        index: PathBuf,
        /// Public HTTP port (default 8083).
        #[arg(long, default_value_t = serve::DEFAULT_PUBLIC_PORT)]
        port: u16,
        /// Private metrics port (default 9466). Public port never serves /metrics.
        #[arg(long, default_value_t = serve::DEFAULT_METRICS_PORT)]
        metrics_port: u16,
    },
}

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();
    match cli.command {
        Command::Index { corpus, out } => {
            let docs = corpus::load_corpus(&corpus)
                .map_err(|e| anyhow::anyhow!(e))
                .with_context(|| format!("cannot parse corpus `{}`", corpus.display()))?;
            if docs.is_empty() {
                anyhow::bail!("corpus `{}` contains no documents", corpus.display());
            }
            let meta = index::build_index(&docs, &out)?;
            println!(
                "indexed {} docs into {} ({} kinds; built at {})",
                meta.docs,
                out.display(),
                meta.kinds.len(),
                meta.built_at
            );
            Ok(())
        }
        Command::Serve {
            index: index_dir,
            port,
            metrics_port,
        } => {
            let runtime = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .context("cannot build tokio runtime")?;
            runtime.block_on(serve::serve(index_dir, port, metrics_port))
        }
    }
}
