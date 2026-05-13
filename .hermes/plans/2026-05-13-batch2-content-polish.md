# Batch 2: Frontend Content & Polish

## 2.1 Interactive API Demo Box

Files: index.html, script.js

**What exists:**
- script.js has `setupDemoBox()` which looks for `.run-btn` and `.demo-output` elements
- On click: shows loading state for 800ms, then displays a mock JSON response

**What to do:**
- Add a `.run-btn` button and `.demo-output` div in the API section (around where the curl code block is)
- Style the output to look like a terminal with syntax-highlighted JSON
- Position it inline with the existing "REST API" card or as a standalone interactive panel
- Test: clicking "▶ Run" shows loading then mock response

## 2.2 AIDA / Bill C-27 Compliance Badge

Files: index.html

**What to do:**
- Add a small compliance badge to the pricing section or footer
- Text: "AIDA-compliant audit trails" or "Bill C-27 ready"
- Style: small green or cyan pill badge matching existing `.badge` styles
- Placement: bottom of pricing section or in the footer trust row

## 2.3 GitHub / Open Source Badge

Files: index.html footer

**What to do:**
- Add a GitHub badge/link in the footer
- Link to https://github.com/reverb256/civint
- Show "Open Source" or "GitHub" as a small badge
- Can use the existing star/fork shield style via inline SVG

## 2.4 Trust Bar Enhancement

Files: index.html

**Current:** Has 5 source badges in a flex row
**What to do:**
- Add "AIDA-ready" badge alongside the source badges
- Ensure badges are consistently styled
- Add hover tooltip explaining each source domain

## Verification

1. Interactive demo shows mock JSON on click
2. Compliance badge visible in pricing/footer
3. GitHub link works in footer
4. Trust bar looks cohesive
