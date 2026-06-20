#!/usr/bin/env python3
"""Push a fine-tuned model to the AI Inference Gateway."""
import argparse
import json
import sys
from pathlib import Path


def push(args):
    """Register model with AI Inference Gateway."""
    model_name = args.name or Path(args.model).name

    # Build model config
    config = {
        "model": model_name,
        "source": "fine-tuned",
        "base_model": args.base_model,
        "path": args.model,
        "backend": "vllm",
        "parameters": {
            "max_model_len": 4096,
            "gpu_memory_utilization": 0.9,
            "tensor_parallel_size": args.tensor_parallel,
        },
        "endpoints": [
            {
                "name": f"{model_name}-chat",
                "type": "chat",
                "path": f"/v1/chat/completions",
            }
        ],
        "labels": {
            "maplespike": "true",
            "type": "fine-tuned",
            "task": "maplespike-qa",
        },
    }

    # Write config
    config_dir = args.gateway_config_dir
    Path(config_dir).mkdir(parents=True, exist_ok=True)
    config_path = Path(config_dir) / f"{model_name}.json"
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)

    print(f"Model config written: {config_path}")
    print(f"Model name: {model_name}")
    print(f"To register, apply the config to the AI Inference Gateway:")
    print(f"  curl -X POST http://ai-inference-gateway:8080/v1/models \\")
    print(f"    -H 'Content-Type: application/json' \\")
    print(f"    -d @{config_path}")


def main():
    parser = argparse.ArgumentParser(description="Push model to AI Inference Gateway")
    parser.add_argument("--model", required=True, help="Path to fine-tuned model directory")
    parser.add_argument("--name", help="Model name (default: directory name)")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-7B-Instruct", help="Base model name")
    parser.add_argument("--tensor-parallel", type=int, default=1, help="Tensor parallel size")
    parser.add_argument("--gateway-config-dir", default="deploy/configs",
                        help="Output config directory")
    args = parser.parse_args()
    push(args)


if __name__ == "__main__":
    main()
