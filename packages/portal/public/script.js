/* ══════════════════════════════════════════════════════════════════
   MapleSpike — Portal JS
   i18n, Dark/Light toggle, mobile menu, scroll-reveal, stat counters, demo
   ══════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const LS_THEME = 'maplespike-theme';
  const LS_INIT = 'maplespike-initialized';
  // Keep in sync with the BaseLayout inline redirect (reads maplespike_lang)
  // and LanguageSwitcher.astro's onclick persist.
  const LS_LOCALE = 'maplespike_lang';

  // One-time migration: the pre-i18n key was `maplespike-locale`. Carry any
  // saved preference forward so existing visitors keep their language.
  (function migrateLocaleKey() {
    try {
      const old = localStorage.getItem('maplespike-locale');
      if (old && !localStorage.getItem(LS_LOCALE)) {
        localStorage.setItem(LS_LOCALE, old);
      }
      localStorage.removeItem('maplespike-locale');
    } catch (e) { /* storage unavailable — ignore */ }
  })();

  // ── i18n Engine ────────────────────────────────────────────────

  const SUPPORTED_LOCALES = ['en-CA', 'fr-CA'];
  const DEFAULT_LOCALE = 'en-CA';

  function detectLocale() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    if (urlLang && SUPPORTED_LOCALES.includes(urlLang)) return urlLang;

    const saved = localStorage.getItem(LS_LOCALE);
    if (saved && SUPPORTED_LOCALES.includes(saved)) return saved;

    if ((navigator.language || '').startsWith('fr')) return 'fr-CA';
    return DEFAULT_LOCALE;
  }

  let currentLocale = detectLocale();
  let i18nData = null;

  async function loadI18n(locale) {
    try {
      const resp = await fetch('assets/i18n/' + locale + '.json?_t=' + Date.now());
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return await resp.json();
    } catch (err) {
      console.warn('[i18n] Failed to load ' + locale + ', falling back to en-CA:', err);
      if (locale !== 'en-CA') return loadI18n('en-CA');
      return null;
    }
  }

  function resolveNestedKey(obj, path) {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : null, obj);
  }

  function applyI18n(data) {
    if (!data) return;
    i18nData = data;
    // The route owns the language on Astro pages. Legacy standalone pages
    // still use the dictionary locale.
    if (!document.getElementById('main-content')) {
      document.documentElement.lang = data.meta?.locale || currentLocale;
    }

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const value = resolveNestedKey(data, key);
      if (value === null) return;

      const attrMatch = key.match(/^(.+?)@(\w+)$/);
      if (attrMatch) {
        const attrValue = resolveNestedKey(data, attrMatch[1]);
        if (attrValue !== null) el.setAttribute(attrMatch[2], attrValue);
        return;
      }

      el.textContent = value;
    });

    // Update language toggle button text
    updateLangToggleUI();
  }

  function updateLangToggleUI() {
    const otherLocale = currentLocale === 'en-CA' ? 'fr-CA' : 'en-CA';
    document.querySelectorAll('.lang-toggle').forEach(btn => {
      btn.textContent = otherLocale === 'en-CA' ? 'FR → EN' : 'EN → FR';
      btn.setAttribute('data-lang', otherLocale);
    });
  }

  async function setLocale(locale) {
    if (!SUPPORTED_LOCALES.includes(locale)) return;

    console.log('[i18n] Switching locale:', currentLocale, '->', locale);
    currentLocale = locale;
    localStorage.setItem(LS_LOCALE, locale);

    const url = new URL(window.location);
    url.searchParams.set('lang', locale);
    window.history.replaceState({}, '', url);

    const data = await loadI18n(locale);
    if (data) {
      applyI18n(data);
      console.log('[i18n] Locale applied successfully:', locale);
    }
  }

  function setupLangToggle() {
    updateLangToggleUI();
    document.querySelectorAll('.lang-toggle').forEach(btn => {
      // Remove old listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', () => {
        const target = newBtn.getAttribute('data-lang');
        if (target) setLocale(target);
      });
    });
  }

  // ── Dark/Light Theme Toggle ──────────────────────────────────

  function applyTheme(theme) {
    // The portal's Tailwind v4 CSS uses a CLASS-based dark variant
    // (@custom-variant dark (&:where(.dark, .dark *))), so the data-theme
    // attribute alone does not change colors — the `.dark` class on <html>
    // is the switch that matters. Keep both in sync.
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }

  function initTheme() {
    const saved = localStorage.getItem(LS_THEME);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(initial);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(LS_THEME, next);

    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.textContent = next === 'dark' ? '\u{1F319}' : '\u{2600}\u{FE0F}';
    });
  }

  function setupThemeToggle() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    // Legacy emoji buttons (class .theme-toggle).
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      // dataset guard: astro:page-load fires on initial load AND every SPA
      // navigation; without it each navigation stacks another listener. The
      // header is re-rendered per navigation so a fresh node re-binds once.
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = '1';
      btn.textContent = theme === 'dark' ? '\u{1F319}' : '\u{2600}\u{FE0F}';
      btn.addEventListener('click', toggleTheme);
    });
    // BaseLayout's nav button is `#theme-toggle` (SVG icons that flip via
    // the .dark class — dark:hidden / hidden dark:block). Wire the click
    // WITHOUT clobbering its innerHTML.
    const navToggle = document.getElementById('theme-toggle');
    if (navToggle && !navToggle.dataset.themeBound) {
      navToggle.dataset.themeBound = '1';
      navToggle.addEventListener('click', toggleTheme);
    }
  }

  // ── Mobile Menu ─────────────────────────────────────────────

  function setupMobileMenu() {
    const toggle = document.querySelector('.nav-mobile-toggle');
    const links = document.querySelector('.nav-links');
    const overlay = document.querySelector('.nav-mobile-overlay');

    if (!toggle || !links) {
      // Astro BaseLayout handles mobile menu via IDs; silently skip legacy class-based setup
      return;
    }

    // Create overlay if it doesn't exist
    if (!overlay) {
      const newOverlay = document.createElement('div');
      newOverlay.className = 'nav-mobile-overlay';
      newOverlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(newOverlay);
    }

    let isOpen = false;

    function openMenu() {
      isOpen = true;
      links.classList.add('open');
      document.querySelector('.nav-mobile-overlay').classList.add('active');
      document.body.style.overflow = 'hidden';
      toggle.setAttribute('aria-expanded', 'true');
      toggle.textContent = '\u2715';
      console.log('[Mobile Menu] Opened');
    }

    function closeMenu() {
      isOpen = false;
      links.classList.remove('open');
      document.querySelector('.nav-mobile-overlay').classList.remove('active');
      document.body.style.overflow = '';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = '\u2630';
      console.log('[Mobile Menu] Closed');
    }

    function toggleMenu() {
      isOpen ? closeMenu() : openMenu();
    }

    // Toggle button click
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });

    // Close on overlay click
    document.querySelector('.nav-mobile-overlay').addEventListener('click', closeMenu);

    // Close on link click
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        setTimeout(closeMenu, 100);
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeMenu();
      }
    });

    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth > 900 && isOpen) {
          closeMenu();
        }
      }, 250);
    });

    console.log('[Mobile Menu] Initialized');
  }

  // ── Scroll-Reveal (IntersectionObserver) ─────────────────────
  // Supports both [data-reveal] attr (cleaner) and .fade-in classes (legacy)

  // One persistent observer, reused across SPA navigations. Handles the
  // legacy `[data-reveal]` / `.fade-in*` hooks AND `.reveal-on-scroll`
  // (pricing, dashboard, explorer, …) so no section stays invisible after a
  // ClientRouter navigation. Already-revealed elements are skipped, making
  // re-runs idempotent.
  let revealObserver = null;
  function setupScrollReveal() {
    if (!('IntersectionObserver' in window)) return;
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target;
            if (el.classList.contains('reveal-on-scroll') || el.classList.contains('clip-reveal')) {
              el.classList.add('is-visible');
            } else {
              el.classList.add(el.hasAttribute('data-reveal') ? 'revealed' : 'visible');
            }
            revealObserver.unobserve(el);
          }
        }
      }, { threshold: 0.15 });
    }
    const attrEls = document.querySelectorAll('[data-reveal]');
    const classEls = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right, .reveal-on-scroll, .clip-reveal');
    for (const el of attrEls) {
      if (!el.classList.contains('revealed')) revealObserver.observe(el);
    }
    for (const el of classEls) {
      if (!el.classList.contains('is-visible') && !el.classList.contains('visible')) revealObserver.observe(el);
    }
  }

  // ── Stat Counter Animation ───────────────────────────────────

  function setupStatCounters() {
    const counters = document.querySelectorAll('.stat .number');
    if (!counters.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const text = el.textContent;
          const num = parseFloat(text.replace(/[^0-9.]/g, ''));
          if (isNaN(num)) return;

          const suffix = text.replace(/[0-9.]/g, '');
          const duration = 1200;
          const start = performance.now();

          function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * num);
            el.textContent = current.toLocaleString() + suffix;
            if (progress < 1) {
              requestAnimationFrame(update);
            } else {
              el.textContent = text;
            }
          }
          requestAnimationFrame(update);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(el => observer.observe(el));
  }

  // ── API Demo Box ────────────────────────────────────────────

  function setupDemoBox() {
    const runBtn = document.querySelector('.run-btn');
    const output = document.querySelector('.demo-output');
    if (!runBtn || !output) return;

    runBtn.addEventListener('click', () => {
      runBtn.disabled = true;
      runBtn.textContent = '⏳ Running...';

      setTimeout(() => {
        output.innerHTML = `{
  "tool": "query_gov_data",
  "query": "GDP",
  "results": [
    {
      "source": "<span class="cyan">Statistics Canada</span>",
      "title": "Gross domestic product, ...",
      "url": "<span class="string">https://www.statcan.gc.ca/...</span>"
    }
  ],
  "totalCount": 1,
  "citation": {
    "hash": "<span class="string">sha256-abc123...</span>",
    "license": "<span class="string">The publisher license was not declared in the metadata returned to Quill. Consult the publisher's terms.</span>",
    "license_basis": "<span class="string">no-publisher-declaration</span>",
    "verified": <span class="keyword">true</span>
  }
}`;
        runBtn.textContent = '▶ Run';
        runBtn.disabled = false;
      }, 800);
    });
  }

  // ── Copy Button for Code Blocks ─────────────────────────────

  function setupCopyButtons() {
    document.querySelectorAll('.code-block').forEach(block => {
      if (block.querySelector('.copy-btn')) return;

      const text = block.textContent.trim();
      if (!text || text.length < 10) return;

      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = '📋';
      btn.title = 'Copy to clipboard';
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = '✓';
          setTimeout(() => { btn.textContent = '📋'; }, 1500);
        });
      });
      block.appendChild(btn);
    });
  }

  // ── Shrink Nav on Scroll ─────────────────────────────────────
  // Delegates to shared nav-scroll.js utility (DRY with BaseLayout)

  function setupNavScroll() {
    if (window.navScroll) {
      window.navScroll.start({ selector: 'nav', threshold: 40, className: 'scrolled' });
    }
  }

  // ── Usage Chart (dashboard) ─────────────────────────────────

  function setupUsageChart() {
    const chart = document.getElementById('usageChart');
    if (!chart || chart.children.length > 0) return;
    fetchLiveStats();
    setTimeout(() => {
      if (chart.children.length === 0) {
        chart.innerHTML = '<div class="empty-chart-msg" style="text-align:center;padding:2rem;color:var(--text-muted);">Usage data unavailable</div>';
      }
    }, 3000);
  }

  // ── Live Stats (dashboard) ──────────────────────────────────

  function setupLiveStats() {
    const callsEl = document.getElementById('callsToday');
    const monthEl = document.getElementById('monthlyUsage');
    const remainEl = document.getElementById('remaining');
    if (!callsEl && !monthEl && !remainEl) return;

    async function fetchLiveStats() {
      const cfg = window.MAPLESPIKE || {};
      const base = cfg.apiBase || 'http://127.0.0.1:8082';
      const key = cfg.apiKey || '';
      const to = cfg.timeout || {};
      try {
        const resp = await fetch(base + '/v1/usage', {
          headers: { 'Authorization': 'Bearer ' + key },
          signal: AbortSignal.timeout(to.default || 8000)
        });
        const data = await resp.json();
        if (data?.success && data?.data) {
          // The API nests the counters under data.usage (routes/usage.ts).
          // Accept a flat shape too, so /v1/me-style bodies keep working.
          const usage = data.data.usage || data.data;
          const daily = usage.daily || {};
          const monthly = usage.monthly || {};
          if (callsEl) callsEl.textContent = daily.calls || 0;
          if (monthEl) monthEl.textContent = monthly.calls || daily.calls || 0;
          const limit = daily.limit || monthly.limit || 1700;
          const remaining = daily.remaining || monthly.remaining || (limit - (daily.calls || 0));
          if (remainEl) remainEl.textContent = remaining;
        }
      } catch (err) {
      }
    }

    fetchLiveStats();
    setInterval(fetchLiveStats, 30000);
  }

  // ── Dashboard Copy Key ──────────────────────────────────────

  function setupDashboardCopy() {
    const copyBtn = document.getElementById('copyBtn');
    const toast = document.getElementById('toast');
    const keyEl = document.getElementById('apiKeyDisplay');
    if (!copyBtn || !keyEl) return;

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(keyEl.textContent).then(() => {
        if (toast) {
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 2000);
        }
      });
    });
  }

  // ── Pricing Toggle (annual/monthly) ─────────────────────────

  function setupPricingToggle() {
    const track = document.querySelector('.toggle-track');
    const prices = document.querySelectorAll('.pricing-card .price');
    if (!track || !prices.length) return;

    track.addEventListener('click', () => {
      track.classList.toggle('active');
      const isAnnual = track.classList.contains('active');

      prices.forEach(p => {
        const amount = p.querySelector('.amount');
        const period = p.querySelector('.period');
        if (!amount || !period) return;

        if (isAnnual) {
          amount.textContent = p.dataset.yearly;
          period.textContent = '/yr';
        } else {
          amount.textContent = p.dataset.monthly;
          period.textContent = '/mo';
        }
      });
    });

    track.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        track.click();
      }
    });
  }

  // ── Regenerate Key (dashboard) ──────────────────────────────

  window.regenerateKey = async function() {
    if (!confirm('Regenerating your API key will invalidate the current one. All services using the old key will stop working. Continue?')) return;

    const btn = document.querySelector('[onclick="regenerateKey()"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Regenerating...'; }

    try {
      const cfg = window.MAPLESPIKE || {};
      const base = cfg.apiBase || 'http://127.0.0.1:8082';
      const key = cfg.apiKey || '';
      const to = cfg.timeout || {};
      const resp = await fetch(base + '/v1/keys', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key },
        signal: AbortSignal.timeout(to.default || 8000)
      });
      const data = await resp.json();

      if (data?.success && data?.data?.key) {
        const keyEl = document.getElementById('apiKeyDisplay');
        if (keyEl) keyEl.textContent = data.data.key;
        if (window.renderApiKeys && data.data.keys) {
          window.renderApiKeys(data.data.keys);
        }
        alert('API key regenerated successfully. Update any services using the old key.');
      } else {
        alert('Failed to regenerate key: ' + (data?.error || 'unknown error'));
      }
    } catch (err) {
      const chars = 'abcdef0123456789';
      let key = 'maplespike-';
      for (let i = 0; i < 32; i++) key += chars[Math.floor(Math.random() * chars.length)];
      const keyEl = document.getElementById('apiKeyDisplay');
      if (keyEl) keyEl.textContent = key;
      alert('API unreachable — generated temporary key: ' + key + '\nRegenerate again when the API is available.');
    }

    if (btn) { btn.disabled = false; btn.textContent = '🔄 Regenerate Key'; }
  };

  // ── Glossary Tooltips ───────────────────────────────────

  const GLOSSARY = {
    'in-camera': 'A parliamentary committee meeting closed to the public. The <code>&lt;InCameraNote/&gt;</code> field in the evidence XML is populated when proceedings go off the public record.',
    'influence-actor': 'An organization tracked for its ability to shape Canadian policy — international organizations (UN, NATO), think tanks (C.D. Howe, Fraser), consultancies (McKinsey, Deloitte), and NGOs (Oxfam, JCCF).',
    'sole-source': 'A government contract awarded to a single vendor without competitive bidding. Often flagged for higher risk of conflict of interest.',
    'signal': 'An automated detection that connects two or more data points across different sources — e.g., a company lobbying a department while holding a sole-source contract from that same department.',
    'entity-resolution': 'The process of identifying when the same person or organization appears across different data sources (committees, lobbying, procurement) and linking those records together.',
    'revolving-door': 'When a person moves between a government role and a lobbying or industry position, especially within a short time frame. Tracked as a conflict-of-interest signal.',
    'mcp': 'Model Context Protocol — an open standard that lets AI tools (ChatGPT, Claude, Gemini) connect to external data sources like MapleSpike through a common interface.',
    'pipeline': 'An automated data processing module that ingests, parses, and verifies records from a specific government source (e.g., the committees pipeline, lobbying pipeline).',
    'sweep': 'A scheduled run of the ingestion engine that collects new data from all sources, runs entity resolution, detects signals, and generates briefs.',
    'provenance': 'Available evidence about a record, captured source responses, declared transformations, and observed publisher terms. Coverage varies; URL matches do not prove record lineage.',
    'citation': 'A SHA-256 hash of Quill canonical record JSON. Recomputing it checks record integrity, not source authenticity, completeness, or reuse rights.',
    'cron-job': 'A scheduled task that runs automatically on the K3s cluster — e.g., daily committee ingestion runs at 6:00 AM UTC.',
    'in-camera-alert': 'A notification generated when a parliamentary committee meeting is flagged as in-camera (closed to the public). These are high-priority signals.',
    'lobbying': 'Communications between organizations and government officials aimed at influencing policy, legislation, or contracting decisions. Tracked by the Office of the Commissioner of Lobbying.',
    'procurement': 'The process by which the government purchases goods and services from private companies. MapleSpike tracks contract awards, sole-source designations, and vendor history.',
    'tier': 'Your MapleSpike subscription level (Public, Civic, Enterprise) that determines API call limits, rate limits, and feature access.',
  };

  function setupGlossary() {
    const terms = document.querySelectorAll('[data-term]');
    if (!terms.length) return;

    let tip = document.getElementById('glossary-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'glossary-tip';
      tip.className = 'glossary-tip';
      document.body.appendChild(tip);
    }

    let hideTimeout = null;
    let activeTerm = null;

    function showTip(el, term) {
      clearTimeout(hideTimeout);
      const def = GLOSSARY[term];
      if (!def) return;

      tip.innerHTML = MAPLESPIKE.sanitizeHtml(`<strong style="color:var(--accent);text-transform:capitalize;">${MAPLESPIKE.esc(term.replace(/-/g,' '))}</strong><br><span style="font-size:0.82rem;color:var(--text-secondary);line-height:1.5;">${MAPLESPIKE.esc(def)}</span>`);
      tip.style.display = 'block';
      tip.style.opacity = '0';
      tip.style.transform = 'translateY(4px)';

      const rect = el.getBoundingClientRect();
      const tipW = Math.min(320, window.innerWidth - 40);
      let left = rect.left + rect.width/2 - tipW/2;
      if (left < 10) left = 10;
      if (left + tipW > window.innerWidth - 10) left = window.innerWidth - tipW - 10;

      tip.style.width = tipW + 'px';
      tip.style.left = left + 'px';
      tip.style.top = (rect.bottom + 8 + window.scrollY) + 'px';

      requestAnimationFrame(() => {
        tip.style.opacity = '1';
        tip.style.transform = 'translateY(0)';
      });
      activeTerm = el;
    }

    function hideTip() {
      hideTimeout = setTimeout(() => {
        tip.style.opacity = '0';
        tip.style.transform = 'translateY(4px)';
        setTimeout(() => { tip.style.display = 'none'; }, 200);
        activeTerm = null;
      }, 200);
    }

    terms.forEach(el => {
      el.style.cursor = 'help';
      el.style.borderBottom = '1px dashed var(--accent)';
      el.style.color = 'var(--accent)';

      el.addEventListener('mouseenter', () => {
        if (activeTerm !== el) hideTip();
        showTip(el, el.dataset.term);
      });
      el.addEventListener('mouseleave', hideTip);
      tip.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
      tip.addEventListener('mouseleave', hideTip);
      el.addEventListener('click', (e) => {
        e.preventDefault();
        showTip(el, el.dataset.term);
      });
    });
  }

  // ── Console signature ──────────────────────────────────────
  console.log(
    '%c⡏⠉⠉⠉⠉⠉⠉⠉⠉⠉⢹ %cMapleSpike',
    'color:#C23030;font-size:10px;', 'color:#C23030;font-size:14px;font-weight:bold;'
  );
  console.log('%c  ⡇ Canadian public data infrastructure ⡇  ', 'color:#D4A017;font-size:10px;');
  console.log('%c  ⢸⠉⠉⠉⠉⠉⠉⠉⠉⠉⡇  ', 'color:#C23030;font-size:10px;');
  console.log('%c  Package license declarations under review', 'color:#0891B2;font-size:11px;');
  console.log('%c  https://github.com/reverb256/quill', 'color:#6B7280;font-size:11px;');

  // ── SDK Tabstrip: multi-language code tabs ──────────────────
  function setupSdkTabs() {
    const tabs = document.querySelectorAll('.sdk-tab');
    if (!tabs.length) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Deactivate all tabs and panels in this tabstrip
        const strip = tab.closest('.sdk-tabstrip');
        if (!strip) return;

        strip.querySelectorAll('.sdk-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        strip.querySelectorAll('.sdk-panel').forEach(p => p.classList.remove('active'));

        // Activate clicked tab and corresponding panel
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const panelId = 'sdk-' + tab.getAttribute('data-tab');
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');
      });
    });
  }

  // ── Live API Code Demo: category switching ─────────────────
  const DEMO_SAMPLES = {
    committees: {
      response: `{\n  "source": "committees",\n  "total": 42,\n  "results": [\n    {\n      "committee": "ENVI",\n      "title": "Climate Adaptation Research",\n      "date": "2025-11-14",\n      "status": "Report Tabled"\n    },\n    {\n      "committee": "FINA",\n      "title": "Carbon Pricing Review",\n      "date": "2025-11-10",\n      "status": "Hearing"\n    }\n  ],\n  "citation": {\n    "hash": "sha256:a1b2c3d4e5f6...",\n    "verified": true\n  }\n}`
    },
    lobbying: {
      response: `{\n  "source": "lobbying",\n  "total": 28,\n  "results": [\n    {\n      "organization": "GreenTech Corp",\n      "subject": "Carbon Pricing Policy",\n      "date": "2025-11-10",\n      "type": "Oral Presentation"\n    },\n    {\n      "organization": "CanEnergy Assoc",\n      "subject": "Emissions Regulations",\n      "date": "2025-11-08",\n      "type": "Written Submission"\n    }\n  ],\n  "citation": {\n    "hash": "sha256:d4e5f6g7h8i9...",\n    "verified": true\n  }\n}`
    },
    procurement: {
      response: `{\n  "source": "procurement",\n  "total": 156,\n  "results": [\n    {\n      "vendor": "DataSys Solutions",\n      "value": "$2,400,000",\n      "department": "PSPC",\n      "type": "Sole Source"\n    },\n    {\n      "vendor": "GreenBuild Inc",\n      "value": "$890,000",\n      "department": "ECCC",\n      "type": "Competitive"\n    }\n  ],\n  "citation": {\n    "hash": "sha256:g7h8i9j0k1l2...",\n    "verified": true\n  }\n}`
    },
    gazette: {
      response: `{\n  "source": "gazette",\n  "total": 12,\n  "results": [\n    {\n      "regulation": "Clean Fuel Standard Amendment",\n      "status": "Pre-publication",\n      "date": "2025-11-01",\n      "department": "ECCC"\n    },\n    {\n      "regulation": "Methane Emissions Reporting",\n      "status": "Final Regulation",\n      "date": "2025-10-15",\n      "department": "ECCC"\n    }\n  ],\n  "citation": {\n    "hash": "sha256:j0k1l2m3n4o5...",\n    "verified": true\n  }\n}`
    },
    courts: {
      response: `{\n  "source": "courts",\n  "total": 7,\n  "results": [\n    {\n      "case": "R. v. Northern Pipeline Corp",\n      "court": "SCC",\n      "date": "2025-10-28",\n      "type": "Appeal Heard"\n    },\n    {\n      "case": "Green Alliance v. Canada (ECCC)",\n      "court": "FCA",\n      "date": "2025-10-20",\n      "type": "Judgment Reserved"\n    }\n  ],\n  "citation": {\n    "hash": "sha256:m3n4o5p6q7r8...",\n    "verified": true\n  }\n}`
    }
  };

  function setupCodeDemo() {
    const demoEl = document.getElementById('live-demo');
    if (!demoEl) return;

    const responseContainer = document.getElementById('demo-response-json');
    if (!responseContainer) return;

    const cats = demoEl.querySelectorAll('.code-demo-cat');

    function renderResponse(source) {
      const sample = DEMO_SAMPLES[source] || DEMO_SAMPLES.committees;
      const json = sample.response;

      // Simple syntax highlighting for JSON
      const highlighted = json
        .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
        .replace(/: "([^"]+)"/g, ': <span class="json-string">"$1"</span>')
        .replace(/: (\d+)/g, ': <span class="json-number">$1</span>')
        .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
        .replace(/: (null)/g, ': <span class="json-null">$1</span>');

      responseContainer.innerHTML = highlighted;
    }

    // Set default
    renderResponse('committees');

    cats.forEach(btn => {
      btn.addEventListener('click', () => {
        cats.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderResponse(btn.getAttribute('data-source'));
      });
    });
  }

  async function init() {
    console.log('[Init] Starting...');
    initTheme();
    setupThemeToggle();
    initTicker();
    setupMobileMenu();

    if (!document.getElementById('main-content')) {
      const data = await loadI18n(currentLocale);
      applyI18n(data);
      setupLangToggle();
    }

    setupScrollReveal();
    setupStatCounters();
    setupGlossary();
    setupDemoBox();
    setupCopyButtons();
    if (!document.getElementById('main-content')) setupNavScroll();
    setupUsageChart();
    setupLiveStats();
    setupDashboardCopy();
    setupPricingToggle();
    setupSdkTabs();
    setupCodeDemo();

    // Astro ClientRouter re-renders the header + page sections on every
    // navigation, which orphans handlers bound once at init (theme toggle
    // died after the first click-through). Re-run the guarded setups on
    // every astro:page-load; dataset markers keep bindings single-per-node.
    document.addEventListener('astro:page-load', () => {
      setupThemeToggle();
      setupScrollReveal();
    });

    console.log('[Init] Complete. Locale:', currentLocale);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Ticker: live data from API ──
  async function initTicker() {
    const ticker = document.querySelector('.ticker-inner');
    if (!ticker) return;
    try {
      const cfg = window.MAPLESPIKE || {};
      const base = cfg.apiBase || 'http://127.0.0.1:8082';
      const to = cfg.timeout || {};
      const resp = await fetch(base + '/v1/health', { signal: AbortSignal.timeout(to.health || 3000) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const json = await resp.json();
      const d = json.data || {};
      const usage = d.usage || {};
      const daily = usage.daily || 0;
      const monthly = usage.monthly || 0;
      const ts = d.timestamp ? new Date(d.timestamp) : new Date();
      const timeStr = ts.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });

      const items = [
        { text: 'API: ' + daily.toLocaleString() + ' requests today', color: '#10B981' },
        { text: 'Monthly: ' + monthly.toLocaleString() + ' queries', color: '#0891B2' },
        { text: 'Status: ' + (d.status === 'ok' ? 'Operational' : d.status), color: d.status === 'ok' ? '#10B981' : '#C23030' },
        { text: 'Updated: ' + timeStr + ' UTC', color: '#D4A017' },
        { text: daily > 0 ? daily + ' sources queried' : 'Pipeline active', color: daily > 0 ? '#C23030' : '#D4A017' },
        { text: 'v' + (d.version || '0.1.0'), color: '#8B5CF6' },
      ];
      const html = items.map(i => `<span class="ticker-item"><span class="ticker-dot" style="background:${i.color};"></span> ${i.text}</span>`).join('');
      ticker.innerHTML = MAPLESPIKE.sanitizeHtml(html + html);
    } catch (e) {
      ticker.innerHTML = '<span class="ticker-item"><span class="ticker-dot" style="background:#6B7280;"></span> Live data unavailable</span><span class="ticker-item"><span class="ticker-dot" style="background:#6B7280;"></span> Live data unavailable</span>';
    }
  }

})();