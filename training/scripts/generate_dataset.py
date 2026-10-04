#!/usr/bin/env python3
"""Generate training dataset from Quill data."""

import argparse
import json
import os
import random
import sys
from pathlib import Path

# Add repo root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from packages.pipeline_core.src.ingestion.registry import MODULE_REGISTRY

TASK_TEMPLATES = {
    "intent_classification": "prompts/intent_classification.txt",
    "entity_extraction": "prompts/entity_extraction.txt",
    "answer_synthesis": "prompts/answer_synthesis.txt",
}

# Example queries per intent for synthetic generation
INTENT_QUERIES = {
    "signal_monitoring": [
        "What new regulations were published this week?",
        "Any changes to lobbying registrations?",
        "Show me recent committee hearings on housing",
    ],
    "entity_research": [
        "What committees is MP Smith on?",
        "Tell me about the Canada Infrastructure Bank",
        "Who lobbied the Minister of Finance last month?",
    ],
    "data_query": [
        "How much did department X spend last quarter?",
        "Show procurement contracts over $1M",
        "What are the latest StatsCan employment numbers?",
    ],
    "document_retrieval": [
        "Find the latest OAG audit report",
        "Get me the transcript of the finance committee meeting",
        "Show the SEDI insider trade filings for January",
    ],
    "trend_analysis": [
        "How has lobbying spending changed over 5 years?",
        "Compare federal transportation budgets year over year",
        "What policy areas had the most committee activity?",
    ],
    "cross_reference": [
        "Which lobbyists met with the minister before the contract was awarded?",
        "Show me conflicts of interest between committee members and lobbyists",
        "Link procurement contracts to lobbying registrations",
    ],
}


def load_prompt_template(task: str) -> str:
    template_path = Path(__file__).resolve().parent.parent / TASK_TEMPLATES[task]
    return template_path.read_text()


def generate_intent_examples(num: int = 100) -> list[dict]:
    """Generate synthetic intent classification examples."""
    examples = []
    for intent, queries in INTENT_QUERIES.items():
        for _ in range(num // len(INTENT_QUERIES)):
            query = random.choice(queries)
            examples.append({
                "messages": [
                    {"role": "system", "content": "Classify the user's intent."},
                    {"role": "user", "content": query},
                    {"role": "assistant", "content": intent},
                ],
                "task": "intent_classification",
                "metadata": {"intent": intent},
            })
    return examples


def generate_entity_examples(num: int = 100) -> list[dict]:
    """Generate synthetic entity extraction examples from pipeline source descriptions."""
    examples = []
    for _ in range(num):
        examples.append({
            "messages": [
                {"role": "system", "content": "Extract entities from the text."},
                {"role": "user", "content": "Parliamentary Budget Officer Yves Giroux appeared before the Standing Committee on Finance to discuss the 2025 fiscal outlook for Canada."},
                {"role": "assistant", "content": '{"people": ["Yves Giroux"], "organizations": ["Parliamentary Budget Officer", "Standing Committee on Finance"], "locations": ["Canada"], "dates": ["2025"], "amounts": []}'},
            ],
            "task": "entity_extraction",
        })
    return examples


def generate_synthesis_examples(num: int = 100) -> list[dict]:
    """Generate synthetic answer synthesis examples."""
    examples = []
    for _ in range(num):
        examples.append({
            "messages": [
                {"role": "system", "content": "Answer with citations."},
                {"role": "user", "content": "What did the ethics commissioner report on?"},
                {"role": "assistant", "content": "The Ethics Commissioner's 2024 annual report covers 27 investigations into potential conflicts of interest. [Source: ethics-commissioner/2024-annual-report]"},
            ],
            "task": "answer_synthesis",
        })
    return examples


def main():
    parser = argparse.ArgumentParser(description="Generate training dataset")
    parser.add_argument("--output", default="data/train.jsonl", help="Output JSONL path")
    parser.add_argument("--sources", default="all", help="Comma-separated modules, or 'all'")
    parser.add_argument("--num", type=int, default=300, help="Total examples")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output), exist_ok=True)

    examples = []
    examples += generate_intent_examples(args.num // 3)
    examples += generate_entity_examples(args.num // 3)
    examples += generate_synthesis_examples(args.num // 3)

    random.shuffle(examples)

    with open(args.output, "w") as f:
        for ex in examples:
            f.write(json.dumps(ex) + "\n")

    print(f"Generated {len(examples)} examples → {args.output}")
    print(f"  Intent: {len([e for e in examples if e['task'] == 'intent_classification'])}")
    print(f"  Entity: {len([e for e in examples if e['task'] == 'entity_extraction'])}")
    print(f"  Synthesis: {len([e for e in examples if e['task'] == 'answer_synthesis'])}")


if __name__ == "__main__":
    main()
