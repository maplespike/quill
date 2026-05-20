
---
last-reviewed: 2026-05-19
status: active

||||||| e980c07
 origin/main
# Editorial Docs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace VitePress docs with portal-native HTML pages using Pretext for editorial text layout, integrated into CI/CD.

**Architecture:** A Node.js build script (`scripts/build-docs.js`) converts markdown from `packages/docs/` into standalone HTML pages using the portal's template (same `styles.css`, `nav.js`, footer). Pretext (`@chenglou/pretext`) handles text measurement and layout in the browser — code blocks become obstacles that body text flows around, inline badges wrap correctly, and accordion sections expand with pre-calculated heights. Nginx serves the generated pages at `/docs/`.

**Tech Stack:** Node.js build script, `marked` (markdown→HTML), `@chenglou/pretext` (text layout), existing portal CSS (`styles.css`), existing nav (`nav.js`).

---