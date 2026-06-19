#!/usr/bin/env python3
"""
Evaluate fine-tuned model against test set.

Usage:
    python scripts/evaluate.py \
        --model models/maplespike-7b \
        --dataset data/eval.jsonl
"""

import argparse
import json
import sys


def evaluate(args):
    """Evaluate model on test dataset."""
    try:
        from unsloth import FastLanguageModel
        import torch
    except ImportError as e:
        print(f"Missing dependency: {e}")
        print("Install: pip install unsloth transformers torch")
        sys.exit(1)

    # Load fine-tuned model
    print(f"Loading model: {args.model}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.model,
        max_seq_length=2048,
        dtype=torch.float16,
        load_in_4bit=True,
    )
    FastLanguageModel.for_inference(model)

    # Load dataset
    examples = []
    with open(args.dataset) as f:
        for line in f:
            examples.append(json.loads(line))

    results = {"intent_classification": [], "entity_extraction": [], "answer_synthesis": []}

    for i, ex in enumerate(examples):
        task = ex.get("task", "unknown")
        messages = ex["messages"]

        # Format prompt
        prompt = ""
        for msg in messages[:-1]:  # All except last assistant message
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                prompt += f"<|system|>\n{content}\n"
            elif role == "user":
                prompt += f"<|user|>\n{content}\n"
            elif role == "assistant":
                prompt += f"<|assistant|>\n{content}\n"
        prompt += "<|assistant|>\n"

        expected = messages[-1]["content"]

        # Generate
        inputs = tokenizer([prompt], return_tensors="pt").to("cuda")
        outputs = model.generate(
            **inputs,
            max_new_tokens=args.max_new_tokens,
            temperature=0.1,
            do_sample=True,
        )
        generated = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        generated = generated.strip()

        results.setdefault(task, []).append({
            "expected": expected,
            "generated": generated,
            "match": expected.strip().lower() == generated.strip().lower(),
        })

        if (i + 1) % 10 == 0:
            print(f"  Evaluated {i + 1}/{len(examples)}")

    # Report
    print("\n=== Evaluation Results ===\n")
    for task, items in results.items():
        if not items:
            continue
        exact_match = sum(1 for r in items if r["match"])
        print(f"{task}:")
        print(f"  Examples: {len(items)}")
        print(f"  Exact match: {exact_match}/{len(items)} ({100 * exact_match / len(items):.1f}%)")
        print(f"  Sample mismatches:")
        mismatches = [r for r in items if not r["match"]][:3]
        for m in mismatches:
            print(f"    Expected: {m['expected'][:80]}...")
            print(f"    Got:      {m['generated'][:80]}...")
        print()


def main():
    parser = argparse.ArgumentParser(description="Evaluate fine-tuned model")
    parser.add_argument("--model", required=True, help="Model path")
    parser.add_argument("--dataset", required=True, help="Eval dataset (JSONL)")
    parser.add_argument("--max-new-tokens", type=int, default=256, help="Max generation tokens")
    args = parser.parse_args()
    evaluate(args)


if __name__ == "__main__":
    main()
