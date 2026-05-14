/* ══════════════════════════════════════════════════════════════════
   MapleSpike — Portal JS
   i18n, Dark/Light toggle, mobile menu, scroll-reveal, stat counters, demo
   ══════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const LS_THEME = 'maplespike-theme';
  const LS_INIT = 'maplespike-initialized';
  const LS_LOCALE = 'maplespike-locale';

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
    document.documentElement.lang = data.meta?.locale || currentLocale;

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
  }

  async function setLocale(locale) {
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    currentLocale = locale;
    localStorage.setItem(LS_LOCALE, locale);

    const url = new URL(window.location);
    url.searchParams.set('lang', locale);
    window.history.replaceState({}, '', url);

    const data = await loadI18n(locale);
    applyI18n(data);
  }

  function setupLangToggle() {
    document.querySelectorAll('.lang-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-lang');
        if (target) setLocale(target);
      });
    });
  }

  // ── Dark/Light Theme Toggle ──────────────────────────────────

  function initTheme() {
    const saved = localStorage.getItem(LS_THEME);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(LS_THEME, next);

    // Update toggle button icon
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.textContent = next === 'dark' ? '\u{1F319}' : '\u{2600}\u{FE0F}';
    });
  }

  function setupThemeToggle() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.textContent = theme === 'dark' ? '\u{1F319}' : '\u{2600}\u{FE0F}';
      btn.addEventListener('click', toggleTheme);
    });
  }

  // ── Mobile Menu ─────────────────────────────────────────────

  function setupMobileMenu() {
    const toggle = document.querySelector('.nav-mobile-toggle');
    const links = document.querySelector('.nav-links');
    if (!toggle || !links) return;

    function closeMenu() {
      links.classList.remove('open');
      toggle.textContent = '\u2630';
      document.body.style.overflow = '';
    }

    function openMenu() {
      links.classList.add('open');
      toggle.textContent = '\u2715';
      document.body.style.overflow = 'hidden';
    }

    toggle.addEventListener('click', () => {
      const isOpen = links.classList.contains('open');
      if (isOpen) closeMenu();
      else openMenu();
    });

    // Close on link click
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && links.classList.contains('open')) closeMenu();
    });
  }

  // ── Scroll-Reveal (IntersectionObserver) ─────────────────────

  function setupScrollReveal() {
    const els = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right');
    if (!els.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    els.forEach(el => observer.observe(el));
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
          // Only animate if it looks like a number
          const num = parseFloat(text.replace(/[^0-9.]/g, ''));
          if (isNaN(num)) return;

          const suffix = text.replace(/[0-9.]/g, '');
          const duration = 1200;
          const start = performance.now();

          function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * num);
            el.textContent = current.toLocaleString() + suffix;
            if (progress < 1) {
              requestAnimationFrame(update);
            } else {
              el.textContent = text; // Restore original
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
    "license": "<span class="string">OGL-C</span>",
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
      // Add copy button if not already present
      if (block.querySelector('.copy-btn')) return;

      // Only add to blocks with content
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

  function setupNavScroll() {
    const nav = document.querySelector('nav');
    if (!nav) return;
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          nav.classList.toggle('scrolled', window.scrollY > 60);
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // ── Usage Chart (dashboard) ─────────────────────────────────

  function setupUsageChart() {
    // Skip if the inline script already rendered the chart
    const chart = document.getElementById('usageChart');
    if (!chart || chart.children.length > 0) return;
    // Fallback: generate sample bars if inline script didn't fire
    const data = [23, 45, 38, 52, 41, 67, 42];
    const max = Math.max(...data);

    const dayLabels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    data.forEach((val, i) => {
      const bar = document.createElement('div');
      bar.className = 'usage-bar' + (i === 6 ? ' today' : '');

      const label = document.createElement('span');
      label.className = 'bar-label';
      label.textContent = dayLabels[i];
      bar.appendChild(label);

      // Set height via style (animation starts from 0 via @keyframes)
      const pct = Math.max((val / max) * 100, 4);
      bar.style.height = pct + '%';
      bar.style.animationDelay = (i * 0.08) + 's';
      bar.title = dayLabels[i] + ': ' + val + ' calls';
      chart.appendChild(bar);
    });
  }

  // ── Live Stats (dashboard) ──────────────────────────────────

  function setupLiveStats() {
    const callsEl = document.getElementById('callsToday');
    const monthEl = document.getElementById('monthlyUsage');
    const remainEl = document.getElementById('remaining');
    if (!callsEl && !monthEl && !remainEl) return;

    // Fetch live stats from the API every 30 seconds
    async function fetchLiveStats() {
      try {
        const resp = await fetch('http://127.0.0.1:8084/v1/usage', {
          headers: { 'Authorization': 'Bearer maplespike-dev-key' }
        });
        const data = await resp.json();
        if (data?.success && data?.data) {
          const usage = data.data;
          const daily = usage.daily || {};
          const monthly = usage.monthly || {};
          if (callsEl) callsEl.textContent = daily.calls || 0;
          if (monthEl) monthEl.textContent = monthly.calls || daily.calls || 0;
          const limit = daily.limit || monthly.limit || 1700;
          const remaining = daily.remaining || monthly.remaining || (limit - (daily.calls || 0));
          if (remainEl) remainEl.textContent = remaining;
        }
      } catch (err) {
        // Silently fall back — inline renderUsageStats handles initial load
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

    // Keyboard support
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
      const resp = await fetch('http://127.0.0.1:8084/v1/keys', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer maplespike-dev-key' }
      });
      const data = await resp.json();

      if (data?.success && data?.data?.key) {
        const keyEl = document.getElementById('apiKeyDisplay');
        if (keyEl) keyEl.textContent = data.data.key;
        // Refresh the keys list
        if (window.renderApiKeys && data.data.keys) {
          window.renderApiKeys(data.data.keys);
        }
        alert('API key regenerated successfully. Update any services using the old key.');
      } else {
        alert('Failed to regenerate key: ' + (data?.error || 'unknown error'));
      }
    } catch (err) {
      // Fallback: generate a client-side key if API is unreachable
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
    'provenance': 'The verifiable chain of custody for a piece of data — from the original government source through ingestion, parsing, and citation hashing. Allows independent verification of any claim.',
    'citation': 'A SHA-256 content hash that uniquely identifies a specific record. Anyone can recompute the hash to verify the data hasn\'t been tampered with.',
    'cron-job': 'A scheduled task that runs automatically on the K3s cluster — e.g., daily committee ingestion runs at 6:00 AM UTC.',
    'in-camera-alert': 'A notification generated when a parliamentary committee meeting is flagged as in-camera (closed to the public). These are high-priority signals.',
    'lobbying': 'Communications between organizations and government officials aimed at influencing policy, legislation, or contracting decisions. Tracked by the Office of the Commissioner of Lobbying.',
    'procurement': 'The process by which the government purchases goods and services from private companies. MapleSpike tracks contract awards, sole-source designations, and vendor history.',
    'tier': 'Your MapleSpike subscription level (Public, Civic, Enterprise) that determines API call limits, rate limits, and feature access.',
  };

  function setupGlossary() {
    const terms = document.querySelectorAll('[data-term]');
    if (!terms.length) return;

    // Create tooltip container
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

      tip.innerHTML = `<strong style="color:var(--accent);text-transform:capitalize;">${term.replace(/-/g,' ')}</strong><br><span style="font-size:0.82rem;color:var(--text-secondary);line-height:1.5;">${def}</span>`;
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
      // Style the term
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

  // ── Console signature (non-template touch) ────────────────
  console.log(
    '%c⡏⠉⠉⠉⠉⠉⠉⠉⠉⠉⢹ %cMapleSpike',
    'color:#C23030;font-size:10px;', 'color:#C23030;font-size:14px;font-weight:bold;'
  );
  console.log('%c  ⡇ Canadian public data infrastructure ⡇  ', 'color:#D4A017;font-size:10px;');
  console.log('%c  ⢸⠉⠉⠉⠉⠉⠉⠉⠉⠉⡇  ', 'color:#C23030;font-size:10px;');
  console.log('%c  Open source · Self-hosted · AGPL-3.0', 'color:#0891B2;font-size:11px;');
  console.log('%c  https://github.com/reverb256/maplespike', 'color:#6B7280;font-size:11px;');──────────────────────────────────────────────────

  async function init() {
    initTheme();
    setupThemeToggle();
    initTicker();
    setupMobileMenu();

    const data = await loadI18n(currentLocale);
    applyI18n(data);
    setupLangToggle();

    setupScrollReveal();
    setupStatCounters();
    setupGlossary();
    setupDemoBox();
    setupCopyButtons();
    setupNavScroll();
    setupUsageChart();
    setupLiveStats();
    setupDashboardCopy();
    setupPricingToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Ticker: live data from API ──
  async function initTicker() {
    const ticker = document.querySelector('.ticker-inner');
    if (!ticker) return; // Page doesn't have a ticker
    try {
      const resp = await fetch('http://127.0.0.1:8085/v1/health', { signal: AbortSignal.timeout(3000) });
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
      // Build ticker HTML (items repeated for seamless loop)
      const html = items.map(i => `<span class="ticker-item"><span class="ticker-dot" style="background:${i.color};"></span> ${i.text}</span>`).join('');
      ticker.innerHTML = html + html;
    } catch (e) {
      // API unavailable — show minimal honest message
      ticker.innerHTML = '<span class="ticker-item"><span class="ticker-dot" style="background:#6B7280;"></span> Live data unavailable</span><span class="ticker-item"><span class="ticker-dot" style="background:#6B7280;"></span> Live data unavailable</span>';
    }
  }

})();
