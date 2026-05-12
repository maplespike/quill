# CivInt Canada — Journalist Quickstart

> **One API key. Verified Canadian government data. No more scraping portals or waiting on ATI.**
>
> Get your free API key at the CivInt developer portal (GitHub Pages).

---

## Five Queries Every Canadian Journalist Should Run

The API endpoint is provided when you get your API key. Replace `CIVINT_API_BASE` with your assigned endpoint.

### 1. Spending by Department (Federal Procurement)

Find recent federal contract awards, filtered by department and minimum value.

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "CIVINT_API_BASE/v1/gov/releases?jurisdiction=federal&category=spending&limit=10"
```

**Story angles:** Sole-source contracts, department spending spikes, procurement trends.

---

### 2. Statistics Canada Releases by Category

Get the latest economic indicators, demographic data, or health statistics.

```bash
# Latest economy releases (GDP, CPI, employment)
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "CIVINT_API_BASE/v1/gov/releases?category=economy&limit=5"

# Latest health indicators
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "CIVINT_API_BASE/v1/gov/releases?category=health&limit=5"
```

**Story angles:** Inflation impact on households, employment trends, healthcare capacity.

**Available categories:** `economy`, `demographics`, `health`, `justice`, `environment`, `education`, `social`, `spending`

---

### 3. Search Across All Government Data Sources

Unified search across Statistics Canada, open.canada.ca, and provincial portals.

```bash
# Search for anything related to housing
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "CIVINT_API_BASE/v1/gov/search?q=housing&jurisdiction=federal"

# Search Ontario data specifically
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "CIVINT_API_BASE/v1/gov/search?q=health+wait+times&jurisdiction=ontario"
```

**Story angles:** Cross-jurisdiction comparison, policy impact research, background for investigative pieces.

---

### 4. Citation Verification (Provenance Chain)

Every data point from CivInt includes a SHA-256 hash. Verify that content hasn't been altered since publication — in one terminal command.

```bash
# Get citation details
curl -H "Authorization: Bearer *** \
  "CIVINT_API_BASE/v1/citation/cit-001"

# Response includes a ready-to-run verify command:
# echo -n "$(curl -s 'CIVINT_API_BASE/v1/gov/releases?jurisdiction=federal&limit=1')" | sha256sum

# Run it yourself to verify:
echo -n "$(curl -s -H 'Authorization: Bearer *** \
  'CIVINT_API_BASE/v1/gov/releases?jurisdiction=federal&limit=1')" | sha256sum
```

**For your stories:** Share a verification link from your citation dashboard. Readers can independently confirm your data hasn't been tampered with.

---

## Journalism Mode

Need editorial flexibility? Frostbite Gazette uses CivInt's journalism-mode API key for unlimited access and editorial overrides. Learn more in the [Frostbite Gazette documentation](https://github.com/reverb256/frostbite-gazette).

Available on: **Pro** tier and above.

---

## Quick Start for Non-Technical Journalists

Don't use the command line? No problem.

1. **Sign up** at the CivInt developer portal — select "Journalist" during onboarding
2. **Copy your API key** from the dashboard
3. **Use the API Explorer** — an interactive web interface where you can:
   - Select a query type (spending, releases, news)
   - Set filters (department, category, date)
   - Click "Run" — results appear instantly
4. **Share a citation link** — every result has a unique URL you can embed in your story

---

## Story Pack Export (Pro / Business)

Bundle data, citations, bias analysis, and attribution into a single downloadable package.

```bash
curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "articles": ["art-001", "art-002"],
    "releases": ["statcan-gdp-march"],
    "includeBias": true,
    "format": "json"
  }' \
  "CIVINT_API_BASE/v1/story-pack"
```

Returns: JSON with all data, citation hashes, bias reports, and OGL-C attribution text — ready to submit to your editor or publish alongside your story.

---

## Pricing for Journalists

| Plan | Price | Calls/mo | Best for |
|------|-------|----------|----------|
| **Free** | $0 | 1,000 | Evaluation, one-off queries |
| **Pro** | $49/mo ($39/mo annual) | 50,000 | Journalists, indie devs, AI builders |
| **Business** | $199/mo ($159/mo annual) | 250,000 | Teams, AI agents |

---

## Attribution Requirements

All responses using Canadian government data include OGL-C attribution:

> *"Contains information licensed under the Open Government Licence – Canada."*

When publishing stories based on CivInt data, include this attribution in your article or data visualization.

---

## Need Help?

- **API Reference:** CIVINT_API_BASE/v1/openapi.json
- **Developer Portal:** reverb256.github.io/civint-ca
- **Support:** support@civint.local
