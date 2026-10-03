# Quill Python SDK (`quill-sdk`)

> **Typed Python client for Canadian government data:**
> Parliament, lobbying, immigration, courts, regulations, oversight, and more.

[![PyPI version](https://img.shields.io/pypi/v/quill-sdk)](https://pypi.org/project/quill-sdk/)
[![Python versions](https://img.shields.io/pypi/pyversions/quill-sdk)](https://pypi.org/project/quill-sdk/)
[![License: MIT](https://img.shields.io/pypi/l/quill-sdk)](LICENSE)

---

## Install

```bash
pip install quill-sdk
```

Optional extras:

```bash
pip install 'quill-sdk[langchain]'   # LangChain agent tools
pip install 'quill-sdk[dev]'         # development tooling
```

## Quick Start

```python
from quill import MapleSpike

ms = MapleSpike(api_key="msk_live_...")

# Query structured data via agents and actions
result = ms.query("committees", "committee-membership", {"parliament": 44})
print(result.data)

# Chained API
result = ms.agent("corporate").action("lobbying-activities", subject="healthcare")
```

### High-level client

```python
from quill import MapleSpikeClient

client = MapleSpikeClient(api_key="msk_live_...")

# AI-powered question answering
answer = client.ask("What committees did MP Smith sit on in 2024?")

# Search across endpoints
results = client.search("lobbying", agent="corporate", limit=10)

# Entity resolution
entity = client.entity_resolution(
    entity_type="corporation",
    query={"business_number": "123456789"},
)

# Data quality metadata
quality = client.data_quality("corporate", "corporation-profile")
```

## Agents

| Agent        | Description                                          |
|--------------|------------------------------------------------------|
| `committees` | Parliamentary committees — membership, meetings, reports, witnesses |
| `corporate`  | Corporate registry — profiles, filings, directors, lobbying |
| `influence`  | Political influence — donations, fundraising, media ownership |
| `regulations`| Regulatory activity — proposals, decisions, consultations |
| `courts`     | Court system — decisions, case tracking, tribunal rulings |
| `oversight`  | Government oversight — audits, watchdogs, ATIP, conflict of interest |
| `data`       | Government data — spending, elections, demographics, salaries |

## LangChain Integration

```python
from quill import get_maplespike_tools

tools = get_maplespike_tools(api_key="msk_live_...")
# Pass tools to any LangChain agent
```

## Documentation

Full API reference: [https://quill.maplespike.ca/docs](https://quill.maplespike.ca/docs)

## Development

```bash
git clone https://github.com/reverb256/quill.git
cd packages/sdk-python
pip install -e ".[dev]"
pytest
```

## License status

`pyproject.toml` declares MIT, but no package-local `LICENSE` file was found in the repository. The published sdist/wheel must be inspected to confirm what license and copyright notices are distributed. See [`LICENSE.md`](../../LICENSE.md) and the [open-source audit](../../docs/open-source-audit.md).
