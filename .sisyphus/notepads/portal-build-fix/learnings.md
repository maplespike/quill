# Portal Build Fix — Learnings

## Radix UI SSR Incompatibility
React 19 SSR breaks multiple Radix UI primitives (Tabs, Dialog/Sheet) in Astro. 
Symptom: "X must be used within Y" errors during `astro build` static generation.

## Actual State (post-audit)
- signal.astro — Already plain HTML tabs (no Radix). ✅
- dashboard.astro — No Tabs at all. ✅
- explorer.astro — No Tabs at all. ✅
- api-explorer.astro — Already plain HTML tabs, but had stale Radix `import`. Fixed by removing import.
- ask.astro — Already plain HTML tabs, no Radix import. ✅
- workspace.astro — Never used Tabs in template, but had stale import. Also had `<Sheet>` (Radix Dialog) which broke SSR. Replaced with plain HTML toggle panel.

## Fix Pattern
Replace `<Sheet>` / `<SheetTrigger>` / `<SheetContent>` with:
1. `<button>` with manual class matching btn style
2. `<div id="panel">` + `<div id="overlay">` for the side panel
3. Inline `<script>` for toggle logic (add/remove `hidden` class, toggle body overflow)
4. Replace Radix `Badge` inside panel with inline `<span>` classes matching Badge variants

Key: all Radix context-based primitives fail in Astro SSR with React 19. Replace with plain HTML + data attributes + inline scripts.
