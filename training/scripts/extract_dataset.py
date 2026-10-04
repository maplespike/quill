#!/usr/bin/env python3
"""
Extract real training data from Quill sources.

This is the core value — generating datasets from actual Canadian government
data (committees, lobbying, corporate filings, procurement) rather than
synthetic examples. The resulting JSONL files can be used to fine-tune any
model when a suitable GPU is available.

Usage:
    python scripts/extract_dataset.py --output data/maplespike-training.jsonl
    python scripts/extract_dataset.py --api http://quill-api:8082 --sources committees,lobbying --limit 500
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
import time
from pathlib import Path
from typing import Any


def fetch_json(api_base: str, path: str, retries: int = 3) -> list[dict] | dict | None:
    """Fetch JSON from the MapleSpike API with retries."""
    url = f"{api_base.rstrip('/')}{path}"
    # Validate URL scheme to prevent SSRF / unexpected protocols
    if url.lower().startswith(('http://', 'https://')) is False:
        print(f"  [skip] non-HTTP URL: {url}")
        return None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            timeout = min(60, max(10, retries * 5))
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                # Dominating guard: verify HTTP status and content type
                if resp.status != 200:
                    print(f"  [warn] HTTP {resp.status} for {url}")
                    return None
                content_type = resp.getheader('Content-Type') or ""
                if "application/json" not in content_type:
                    print(f"  [warn] non-JSON content type: {content_type}")
                    return None
                return json.loads(resp.read())
        except urllib.error.URLError as e:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"  [retry {attempt + 1}] {url}: {e} — waiting {wait}s")
                time.sleep(wait)
            else:
                print(f"  [FAIL] {url}: {e}")
                return None
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"  [retry {attempt + 1}] {url}: unexpected {e} — waiting {wait}s")
                time.sleep(wait)
            else:
                print(f"  [FAIL] {url}: unexpected {e}")
                return None


def extract_committees(api_base: str, limit: int = 200) -> list[dict]:
    """Extract committee meeting transcripts and evidence."""
    examples = []
    print(f"Extracting committees (limit={limit})...")

    # Search for committee evidence
    data = fetch_json(api_base, f"/v1/search/committees?query=meeting&limit={limit}")
    if not data:
        return examples

    records = data if isinstance(data, list) else data.get("results", data.get("data", [data]))
    for i, rec in enumerate(records[:limit]):
        title = rec.get("title") or rec.get("name") or rec.get("topic", "")
        content = rec.get("content") or rec.get("description") or rec.get("text", "")
        source = rec.get("committee") or rec.get("source", "committees")
        date = rec.get("date") or rec.get("meetingDate", "")

        if not content or len(content) < 50:
            continue

        examples.append({
            "messages": [
                {"role": "system", "content": "You are a Canadian parliamentary data analyst."},
                {"role": "user", "content": f"What was discussed in the {source} committee meeting on {date}?"},
                {"role": "assistant", "content": content[:1500]},
            ],
            "task": "answer_synthesis",
            "metadata": {
                "source": "committees",
                "module": source,
                "date": date,
                "title": title,
            },
        })

    print(f"  → {len(examples)} committee examples")
    return examples


def extract_lobbying(api_base: str, limit: int = 200) -> list[dict]:
    """Extract lobbying registry records for entity extraction training."""
    examples = []
    print(f"Extracting lobbying (limit={limit})...")

    data = fetch_json(api_base, f"/v1/search/corporate?query=lobbying&dataset=lobbying&limit={limit}")
    if not data:
        return examples

    records = data if isinstance(data, list) else data.get("results", data.get("data", [data]))
    for i, rec in enumerate(records[:limit]):
        text = json.dumps(rec, indent=2)
        if len(text) < 100:
            continue

        # Build entity extraction example from raw record
        examples.append({
            "messages": [
                {"role": "system", "content": "Extract entities from this lobbying record."},
                {"role": "user", "content": text[:2000]},
                {"role": "assistant", "content": "Entity extraction training example from lobbying registry."},
            ],
            "task": "entity_extraction",
            "metadata": {
                "source": "lobbying",
                "module": rec.get("registry", "lobbying"),
            },
        })

        # Build intent classification example
        org = rec.get("organization", {}).get("name", "") or rec.get("client", {}).get("name", "")
        subject = rec.get("subject", "")
        if org and subject:
            examples.append({
                "messages": [
                    {"role": "system", "content": "Classify the user's intent."},
                    {"role": "user", "content": f"What lobbying did {org} do regarding {subject}?"},
                    {"role": "assistant", "content": "signal_monitoring"},
                ],
                "task": "intent_classification",
                "metadata": {"source": "lobbying", "organization": org, "subject": subject},
            })

    print(f"  → {len(examples)} lobbying examples")
    return examples


def extract_federal_budget(api_base: str, limit: int = 100) -> list[dict]:
    """Extract budget/spending data for QA training."""
    examples = []
    print(f"Extracting budget data (limit={limit})...")

    data = fetch_json(api_base, f"/v1/search/corporate?query=spending&dataset=procurement&limit={limit}")
    if not data:
        return examples

    records = data if isinstance(data, list) else data.get("results", data.get("data", [data]))
    for rec in records[:limit]:
        vendor = rec.get("vendor", {}).get("name", "") or rec.get("supplier", "")
        value = rec.get("value") or rec.get("contractValue") or rec.get("amount", "")
        department = rec.get("department", {}).get("name", "") or rec.get("owner", "")
        desc = rec.get("description") or rec.get("subject", "")

        if not vendor or not value:
            continue

        examples.append({
            "messages": [
                {"role": "system", "content": "You are a Canadian government spending analyst."},
                {"role": "user", "content": f"How much did {department} spend with {vendor}?"},
                {"role": "assistant", "content": f"The contract between {department} and {vendor} was valued at ${value}. Description: {desc[:500]}"},
            ],
            "task": "answer_synthesis",
            "metadata": {"source": "procurement", "vendor": vendor, "department": department},
        })

    print(f"  → {len(examples)} budget examples")
    return examples


def extract_regulatory(api_base: str, limit: int = 100) -> list[dict]:
    """Extract regulatory filings and GIC appointments."""
    examples = []
    print(f"Extracting regulatory (limit={limit})...")

    for dataset, label in [("gic", "GIC appointments"), ("regulatory", "regulatory filings")]:
        data = fetch_json(api_base, f"/v1/search/corporate?query=appointment&dataset={dataset}&limit={limit}")
        if not data:
            continue
        records = data if isinstance(data, list) else data.get("results", data.get("data", [data]))
        for rec in records[:limit]:
            examples.append({
                "messages": [
                    {"role": "system", "content": "Extract entities from this government record."},
                    {"role": "user", "content": json.dumps(rec, indent=2)[:2000]},
                    {"role": "assistant", "content": "Entity extraction example from government record."},
                ],
                "task": "entity_extraction",
                "metadata": {"source": "regulatory", "dataset": dataset},
            })

    print(f"  → {len(examples)} regulatory examples")
    return examples


def main():
    parser = argparse.ArgumentParser(description="Extract real training data from Quill")
    parser.add_argument("--api", default="http://quill-api:8082",
                        help="MapleSpike API base URL")
    parser.add_argument("--output", default="data/maplespike-training.jsonl", help="Output JSONL path")
    parser.add_argument("--sources", default="all",
                        help="Comma-separated: committees,lobbying,budget,regulatory or 'all'")
    parser.add_argument("--limit", type=int, default=500, help="Max records per source")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output), exist_ok=True)

    sources = args.sources.split(",") if args.sources != "all" else ["committees", "lobbying", "budget", "regulatory"]

    all_examples = []

    extractors = {
        "committees": extract_committees,
        "lobbying": extract_lobbying,
        "budget": extract_federal_budget,
        "regulatory": extract_regulatory,
    }

    for source in sources:
        if source in extractors:
            try:
                examples = extractors[source](args.api, args.limit)
                all_examples.extend(examples)
            except Exception as e:
                print(f"  [ERROR] extracting {source}: {e}")
        else:
            print(f"  [SKIP] unknown source: {source}")

    # Write deduplicated output
    seen = set()
    unique = []
    for ex in all_examples:
        key = json.dumps(ex["messages"], sort_keys=True)
        if key not in seen:
            seen.add(key)
            unique.append(ex)

    with open(args.output, "w") as f:
        for ex in unique:
            f.write(json.dumps(ex) + "\n")

    # Summary
    print(f"\n=== Summary ===")
    print(f"Total examples: {len(unique)}")
    for task in ["intent_classification", "entity_extraction", "answer_synthesis"]:
        count = sum(1 for e in unique if e["task"] == task)
        print(f"  {task}: {count}")
    print(f"\nOutput: {args.output}")


if __name__ == "__main__":
    main()
