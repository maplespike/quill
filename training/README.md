# Sovereign LLM Fine-tuning Pipeline

Domain-specific dataset generation and fine-tuning for MapleSpike.

## What This Is

The value is the **dataset** — real training examples extracted from actual
Canadian government data: committees transcripts, lobbying registrations,
procurement contracts, GIC appointments, and regulatory filings.

The fine-tuning scripts are optional extras for when you have a suitable GPU
(24GB+ VRAM recommended). The dataset itself works with any LLM fine-tuning
framework.

## Quick Start

```bash
# 1. Extract real training data from the running API
python scripts/extract_dataset.py \
  --api http://quill-api:8082 \
  --sources committees,lobbying,budget,regulatory \
  --limit 500 \
  --output data/maplespike-training.jsonl

# 2. Inspect the dataset
wc -l data/maplespike-training.jsonl
head -1 data/maplespike-training.jsonl | python3 -m json.tool
```

## Dataset Format

Each line is a JSON object with ChatML-formatted messages:

```json
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "task": "answer_synthesis",
  "metadata": {
    "source": "committees",
    "module": "HESA",
    "date": "2025-03-12",
    "title": "Appearance of Minister of Health"
  }
}
```

Three task types:

| Task | Description | Source |
|------|-------------|--------|
| `intent_classification` | Classify user query → 6 intents | Lobbying subjects, committee topics |
| `entity_extraction` | Extract PEOPLE, ORG, LOC, etc. | Lobbying records, regulatory filings |
| `answer_synthesis` | Produce cited answers from context | Committees transcripts, procurement |

## Data Sources

| Source | API Endpoint | Examples Generated |
|--------|-------------|-------------------|
| Committees | `/v1/search/committees` | QA pairs from meeting transcripts |
| Lobbying | `/v1/search/corporate?dataset=lobbying` | Entity extraction + intent classification |
| Procurement | `/v1/search/corporate?dataset=procurement` | QA pairs from contract data |
| GIC/Regulatory | `/v1/search/corporate?dataset=gic` | Entity extraction from appointments |

Run against the internal API (`quill-api:8082`) from within the cluster.

## Fine-tuning (Optional — requires GPU)

### Hardware Targets

| GPU | VRAM | Capability | Model Options |
|-----|------|-----------|---------------|
| RTX 3090 | 24 GB | Full fine-tuning | Qwen 2.5-14B, Llama 3.1-8B, Gemma 4 E4B |
| RTX 4060 | 8 GB | QLoRA only | Gemma 4 E4B, Qwen 2.5-7B, Llama 3.2-3B |
| 2x RTX 4060 | 16 GB total | QLoRA + DDP | Same as above with higher throughput |
| A100/H100 | 80 GB | Full fine-tuning | Any model up to 70B |

### Training (when GPU is available)

```bash
pip install -r requirements.txt

# QLoRA fine-tuning
python scripts/train.py \
  --base-model unsloth/gemma-4-E4B-it \
  --dataset data/maplespike-training.jsonl \
  --output-dir models/maplespike-v1 \
  --lora-r 16

# Evaluate
python scripts/evaluate.py \
  --model models/maplespike-v1 \
  --dataset data/maplespike-training.jsonl
```

### Deploy to AI Inference Gateway

```bash
python scripts/push_to_gateway.py \
  --model models/maplespike-v1 \
  --name maplespike-qa-v1 \
  --base-model unsloth/gemma-4-E4B-it
```

## Directory Structure

```
training/
├── README.md              ← This file
├── requirements.txt       ← Python deps for training
├── data/                  ← Generated datasets (gitignored)
├── models/                ← Fine-tuned checkpoints (gitignored)
├── scripts/
│   ├── extract_dataset.py ← Main: extract real data from pipeline API
│   ├── train.py           ← Unsloth QLoRA fine-tuning
│   ├── evaluate.py        ← Evaluation against held-out test set
│   └── push_to_gateway.py ← Register model with AI Inference Gateway
├── prompts/               ← Prompt templates for data generation
└── deploy/                ← AI Inference Gateway config
```

## References

- Issue [#318](https://github.com/maplespike/quill/issues/318)
- AI Inference Gateway: internal cluster service
- Unsloth: https://unsloth.ai
