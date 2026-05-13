# Batch 1: Frontend Interactive Wiring

Wire up existing CSS/JS features that are styled but not connected.

## 1.1 Mobile Hamburger Menu

Files: all 4 pages (index.html, dashboard.html, docs.html, agents.html)

**What exists:**
- CSS has `.nav-mobile-toggle`, `.nav-links.open`, `.nav-mobile-overlay` in styles.css
- script.js has `setupMobileMenu()` which toggles `.open` on `.nav-links` and changes hamburger icon
- HTML has `<button class="nav-mobile-toggle">☰</button>` in the nav

**What's missing:**
- Verify the hamburger button exists on all 4 pages
- Verify the CSS class names match what script.js expects
- Verify `.nav-mobile-overlay` div exists for mobile backdrop
- Test: resize to <768px, click hamburger, menu should slide in

## 1.2 Stat Counter Animation

Files: index.html

**What exists:**
- CSS has `@keyframes countUp` (check styles.css)
- script.js has `setupStatCounters()` which looks for `.stat .number` elements
- The stats section in index.html has stat numbers

**What's missing:**
- The stats section HTML needs elements matching `.stat .number` or update the JS selector to match actual HTML classes
- Add `data-target` attributes with the target number
- Ensure each stat element has a `.number` class or the JS selector matches

## 1.3 Pricing Toggle (Annual/Monthly)

Files: index.html + script.js

**What exists:**
- CSS has `.pricing-toggle`, `.toggle-track`, `.toggle-knob` styling
- script.js has `setupPricingToggle()` which looks for toggle button and price elements with `data-monthly`/`data-yearly` attrs
- HTML has a "Toggle annual pricing" button and `.price` elements

**What's missing:**
- Ensure `.price` elements have `data-monthly` and `data-yearly` attributes with correct values
- Verify the toggle button ID/class matches what script.js expects
- Test: clicking toggle switches prices and updates period text

## 1.4 Copy Buttons for Code Blocks

Files: all pages with code blocks

**What exists:**
- script.js has `setupCopyButtons()` which finds `.code-block` elements and adds `.copy-btn`
- Some pages may already have the 📋 buttons

**What's missing:**
- Ensure code blocks use `.code-block` class
- Verify copy works in both secure context (https) and localhost (http)

## Verification

After changes:
1. All 4 pages load without JS errors
2. Mobile menu works at <768px viewport
3. Stat numbers animate on scroll
4. Pricing toggle switches monthly/yearly
5. Copy buttons appear on all code blocks and copy correctly
