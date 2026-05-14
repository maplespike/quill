---
last-reviewed: 2026-05-14
status: active
---

# MapleSpike Python SDK

> **`maplespike-sdk`** — Typed Python client for Canadian government data: Parliament, lobbying, immigration, courts, regulations, oversight, and more.

```python
from maplespike import MapleSpike

ms = MapleSpike(api_key="msk_live_...")

# Query immigration data
residents = ms.immigration.permanent_residents(province="ON", year=2025)

# Search lobbying registry
lobbying = ms.corporate.lobbying(subject="healthcare")

# Get court decisions
decisions = ms.courts.decisions(court="SCC", year=2024)
```

## Install

```bash
pip install maplespike-sdk
```

## Quick Start

```python
from maplespike import MapleSpike

ms = MapleSpike(api_key="your_api_key")

# Domain methods are fully typed
result = ms.immigration.permanent_residents(province="ON", limit=10)
print(f"Found {result.total} records")

# Generic query for any endpoint
data = ms.query("regulations", "regulatory-proposals", {"status": "open"})
```

## Documentation

Full API reference: [https://maplespike.ca/docs.html](https://maplespike.ca/docs.html)

## Development

```bash
git clone https://github.com/reverb256/maplespike.git
cd maplespike/packages/sdk-python
pip install -e ".[dev]"
pytest
```

## License

MIT — see [LICENSE](LICENSE)
