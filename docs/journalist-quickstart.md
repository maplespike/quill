# MapleSpike Canada — Journalist Quickstart

> **Access Canadian government data through MCP tools. No more scraping portals or waiting on ATI.**
>
> MapleSpike is a **public API service** (self-hosted on K3s, open-source core). Access via MCP, REST API, SDK. Free tier available — no credit card required.

---

## Quick Intro

MapleSpike ingests 13+ modules of Canadian government data — House of Commons and Senate committees, federal lobbying, procurement, Canada Gazette, GIC appointments, provincial lobbying registries, Elections Canada third-party advertising, oversight bodies (OAG, PBO, Ethics Commissioner, Competition Bureau, CRTC), CanLII court decisions, and LMIA data.

Every record includes SHA-256 citation hashes for independent verification.

---

## Access Methods

### 1. MCP Server (Recommended)

The MapleSpike MCP server exposes 14 tools for AI agents. If you have access to the K3s cluster, you can connect Claude Desktop, Cursor, or any MCP-compatible client to the hosted SSE endpoint.

**Configure Claude Desktop:**

```json
{
  "mcpServers": {
    "maplespike": {
      "url": "http://maplespike-mcp.ai-inference.svc.lan:3001/sse"
    }
  }
}
```

**Available MCP tools:**

| Tool | Status | Description |
|------|--------|-------------|
| `query_gov_data` | ✅ LIVE | Query government data by keyword/jurisdiction |
| `fact_check` | ✅ LIVE | Check a claim against official data |
| `get_citation` | ✅ LIVE | Retrieve and verify SHA-256 citation hash |
| `latest_releases` | ✅ LIVE | Recent government data releases |
| `search_committees` | 🟡 COMING | Full-text committee intervention search — returns empty pending database deployment |
| `search_corporate` | 🟡 COMING | Lobbying + procurement search |
| `search_influence` | 🟡 COMING | Influence actor investigation |
| `search_gazette` | 🟡 COMING | Canada Gazette regulation search |
| `search_gic` | 🟡 COMING | GIC appointment lookup |
| `search_elections` | 🟡 COMING | Elections Canada third-party advertiser search |
| `search_provincial_lobbying` | 🟡 COMING | BC/ON/QC lobbying registry search |
| `search_oversight` | 🟡 COMING | OAG/PBO/Ethics/Competition Bureau/CRTC search |
| `search_canlii` | 🟡 COMING | Court decision search via CanLII |
| `search_lmia` | 🟡 COMING | LMIA quarterly data search |

> ⚠️ **4 tools are live now** (green). The remaining 10 search tools are in development — they accept queries but return empty results while the database layer is being deployed. See the [ROADMAP](../ROADMAP.md) for timeline.

### 2. REST API (If Deployed)

If the api-server is deployed on the cluster, you can make direct HTTP calls:

```bash
# Search government data releases
curl -H "Authorization: Bearer *** \
  "http://maplespike-api.ai-inference.svc.lan/v1/gov/releases?jurisdiction=federal&category=spending&limit=10"
```

### 3. CLI (Local Development)

```bash
# Clone and build
git clone <repo-url>
cd maplespike
pnpm install
pnpm run build

# Run MCP server locally via stdio
cd packages/mcp-server
pnpm start
```

Then connect your MCP client to `stdio` transport.

---

## Five Queries Every Canadian Journalist Should Run

> 🟡 These search tools are being wired — they accept queries but return empty until the database layer deploys. The examples below show the tool name and expected parameters.

### 1. Find Recent Committee Meetings on a Topic (Coming Soon)

Ask your AI agent: **"Search committee transcripts for recent mentions of housing policy"**

This uses the `search_committees` tool to find interventions across all 50 committees (30 HoC + 20 Senate). Once DB is live, this searches `committee_interventions` via `searchTranscripts()`.

### 2. Track Lobbying Activity Around a Bill (Coming Soon)

Ask your AI agent: **"Search for lobbying records related to Bill C-27"**

This uses the `search_corporate` tool to query the federal lobbying registry. Requires corporate ingestion DB persistence to be deployed.

### 3. Find Sole-Source Contracts by Department (Coming Soon)

Ask your AI agent: **"Find sole-source contracts awarded by Department of National Defence in the last quarter"**

This uses the `search_corporate` tool with the `isSoleSource()` flag. Requires procurement DB persistence.

### 4. Investigate an Organization's Influence Footprint (Coming Soon)

Ask your AI agent: **"Search for all data on the influence activity of the Fraser Institute"**

This uses `search_influence` to find committee appearances, lobbying, funding, and CRA charity status. Requires influence tracking data pipeline deployed.

### 5. Verify a Data Point by Citation Hash (LIVE NOW)

Ask your AI agent: **"Verify citation cit-001 and show the verification command"**

This uses `get_citation` to retrieve the SHA-256 hash and verify data integrity. **Works today.**

---

## Working Tools You Can Use Right Now

These 4 tools return real data immediately with no database dependency:

| Tool | What it queries | Example prompt |
|------|----------------|----------------|
| `latest_releases` | Statistics Canada WDS API | "What are the latest StatCan data releases?" |
| `query_gov_data` | CKAN portals (fed + provincial) | "Search open.canada.ca for GDP data" |
| `fact_check` | StatCan + CKAN evidence | "Fact check: Canada's unemployment rate is 6.5%" |
| `get_citation` | Citation hash store | "Verify citation cit-001" |

---

## Citation Verification

Every record includes a SHA-256 content hash. You can verify data integrity from any terminal:

```bash
# Get citation details
curl -H "Authorization: Bearer *** \
  "http://maplespike-api.ai-inference.svc.lan/v1/citation/cit-001"

# Verify via sha256sum:
echo -n "$(curl -s -H 'Authorization: Bearer *** \
  'http://maplespike-api.ai-inference.svc.lan/v1/gov/releases?jurisdiction=federal&limit=1')" | sha256sum
```

---

## Attribution Requirements

All responses using Canadian government data include OGL-C attribution:

> *"Contains information licensed under the Open Government Licence – Canada."*

When publishing stories based on MapleSpike data, include this attribution in your article or data visualization.

---

## What's NOT Available (Not Built)

- Public signup / developer portal with API key generation
- Usage dashboard or billing portal
- Web-based API explorer (Swagger UI)
- Journalism mode with editorial overrides
- Story pack export bundles
- Shareable citation pages (human-readable HTML)
- Email notifications

---

## Need Help?

- **Repo:** [https://github.com/reverb256/maplespike](https://github.com/reverb256/maplespike)
- **Docs:** See [README.md](../README.md) and [ROADMAP.md](../ROADMAP.md)
- **MCP configuration:** See MCP server docs in `packages/mcp-server/`
