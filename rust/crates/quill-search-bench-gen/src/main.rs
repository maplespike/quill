//! quill-search-bench-gen CLI (issue #976): write a deterministic JSONL
//! bench corpus to a path. Used by the criterion bench bootstrap, the Node
//! baseline script, and operators reproducing the recorded numbers.

use clap::Parser;
use quill_search_bench_gen::generate_to;
use std::path::PathBuf;

#[derive(Parser)]
#[command(
    name = "quill-search-bench-gen",
    about = "Deterministic JSONL bench-corpus generator for quill-search (#976)"
)]
struct Cli {
    /// Number of documents.
    #[arg(long)]
    docs: u64,
    /// Output JSONL path.
    #[arg(long)]
    out: PathBuf,
    /// Deterministic seed (default 42).
    #[arg(long, default_value_t = 42)]
    seed: u64,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let n = generate_to(&cli.out, cli.docs, cli.seed)?;
    println!("generated {n} docs into {}", cli.out.display());
    Ok(())
}
