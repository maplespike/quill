#!/usr/bin/env python3
"""
Fine-tune Gemma 4 E4B on MapleSpike data using Unsloth with Vulkan backend.

Target hardware: AMD Radeon RX 5700 XT on forge (NixOS)
Vulkan ICD: amdgpu + radv (see README for driver setup)

Usage:
    python scripts/train.py \
        --base-model unsloth/gemma-4-E4B-it \
        --dataset data/train.jsonl \
        --output-dir models/maplespike-gemma4
"""

import argparse
import json
import os
import sys
from pathlib import Path


def train(args):
    """Run fine-tuning via Unsloth."""
    try:
        from unsloth import FastLanguageModel, is_bfloat16_supported
        import torch
        from datasets import Dataset
        from transformers import TrainingArguments
        from trl import SFTTrainer
    except ImportError as e:
        print(f"Missing dependency: {e}")
        print("Install: pip install unsloth[torch-vulkan] transformers datasets trl")
        sys.exit(1)

    # Vulkan device selection
    if args.use_vulkan:
        if not torch.backends.vulkan.is_available():
            print("WARNING: Vulkan backend not available in torch.")
            print("For AMD GPUs on NixOS, ensure RADV Vulkan driver is installed:")
            print("  hardware.opengl = { enable = true; driSupport = true; }")
            print("  hardware.amdgpu.opencl = true")
            print("  environment.sessionVariables.NIXOS_OZONE_WAYLAND = 0")
            print("")
            print("Falling back to CPU (extremely slow).")
        else:
            print("Using Vulkan backend")

    device_map = "auto" if not args.use_vulkan else "cpu"

    # Load dataset
    print(f"Loading dataset: {args.dataset}")
    examples = []
    with open(args.dataset) as f:
        for line in f:
            examples.append(json.loads(line))
    dataset = Dataset.from_list(examples)

    # Format as Gemma-4 style prompt
    def format_chat(example):
        text = ""
        for msg in example["messages"]:
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                text += f"<bos><start_of_turn>user\n{content}<end_of_turn>\n"
            elif role == "user":
                text += f"<start_of_turn>user\n{content}<end_of_turn>\n"
            elif role == "assistant":
                text += f"<start_of_turn>model\n{content}<end_of_turn>\n"
        text += "<start_of_turn>model\n"
        return {"text": text}

    dataset = dataset.map(format_chat)

    split = dataset.train_test_split(test_size=0.1, seed=42)
    train_dataset = split["train"]
    eval_dataset = split["test"]

    print(f"Train: {len(train_dataset)} | Eval: {len(eval_dataset)}")

    # Load base model
    print(f"Loading base model: {args.base_model}")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base_model,
        max_seq_length=args.max_seq_length,
        dtype=torch.float16 if not is_bfloat16_supported() else torch.bfloat16,
        load_in_4bit=args.load_in_4bit,
        device_map=device_map,
    )

    # LoRA adapters
    model = FastLanguageModel.get_peft_model(
        model,
        r=args.lora_r,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        lora_alpha=args.lora_alpha,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
        use_rslora=False,
    )

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        warmup_ratio=0.05,
        num_train_epochs=args.epochs,
        learning_rate=args.learning_rate,
        fp16=not is_bfloat16_supported(),
        bf16=is_bfloat16_supported(),
        logging_steps=10,
        save_strategy="steps",
        save_steps=100,
        save_total_limit=2,
        eval_strategy="steps",
        eval_steps=100,
        report_to="none",
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="cosine",
        seed=42,
        dataloader_pin_memory=False,
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        dataset_text_field="text",
        max_seq_length=args.max_seq_length,
        dataset_num_proc=2,
        packing=False,
        args=training_args,
    )

    print("Starting training...")
    trainer.train()

    print(f"Saving model to: {args.output_dir}")
    model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    print("Done!")


def main():
    parser = argparse.ArgumentParser(description="Fine-tune Gemma 4 E4B on MapleSpike data")
    parser.add_argument("--base-model", default="unsloth/gemma-4-E4B-it",
                        help="Base model (HF path)")
    parser.add_argument("--dataset", required=True, help="Training dataset (JSONL)")
    parser.add_argument("--output-dir", default="models/maplespike-gemma4", help="Output dir")
    parser.add_argument("--lora-r", type=int, default=16, help="LoRA rank")
    parser.add_argument("--lora-alpha", type=int, default=32, help="LoRA alpha")
    parser.add_argument("--batch-size", type=int, default=1, help="Per-device batch size")
    parser.add_argument("--grad-accum", type=int, default=8, help="Gradient accumulation steps")
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs")
    parser.add_argument("--learning-rate", type=float, default=2e-4, help="Learning rate")
    parser.add_argument("--max-seq-length", type=int, default=2048, help="Max sequence length")
    parser.add_argument("--load-in-4bit", action="store_true", default=True,
                        help="4-bit quantization")
    parser.add_argument("--use-vulkan", action="store_true", default=True,
                        help="Use Vulkan backend (AMD GPU)")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    train(args)


if __name__ == "__main__":
    main()
