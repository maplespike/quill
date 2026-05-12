/* ══════════════════════════════════════════════════════════════════
   CivInt Canada — Portal JS
   Dark/Light toggle, mobile menu, scroll-reveal, stat counters, demo
   ══════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const LS_THEME = 'civint-theme';
  const LS_INIT = 'civint-initialized';

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

    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      toggle.textContent = links.classList.contains('open') ? '\u2715' : '\u2630';
    });

    // Close on link click
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.textContent = '\u2630';
      });
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
    const chart = document.getElementById('usageChart');
    if (!chart) return;

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
    if (!callsEl || !monthEl || !remainEl) return;

    setInterval(() => {
      const calls = parseInt(callsEl.textContent) + 1;
      callsEl.textContent = calls;
      const month = parseInt(monthEl.textContent) + 1;
      monthEl.textContent = month;
      remainEl.textContent = Math.max(0, 1000 - month);
    }, 8000);
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

  window.regenerateKey = function() {
    if (!confirm('Regenerating your API key will invalidate the current one. All services using the old key will stop working. Continue?')) return;
    const chars = 'abcdef0123456789';
    let key = 'civint-';
    for (let i = 0; i < 32; i++) key += chars[Math.floor(Math.random() * chars.length)];
    const keyEl = document.getElementById('apiKeyDisplay');
    if (keyEl) keyEl.textContent = key;
    const callsEl = document.getElementById('callsToday');
    const monthEl = document.getElementById('monthlyUsage');
    const remainEl = document.getElementById('remaining');
    if (callsEl) callsEl.textContent = '0';
    if (monthEl) monthEl.textContent = '0';
    if (remainEl) remainEl.textContent = '1000';
    alert('API key regenerated. Update any services using the old key.');
  };

  // ── Hero Canvas Particle Network ──────────────────────────

  function setupHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let w, h, particles = [];
    const PARTICLE_COUNT = 80;
    const CONNECTION_DIST = 150;
    const PARTICLE_RADIUS = 2;
    const MOUSE_RADIUS = 100;

    let mouseX = -1000;
    let mouseY = -1000;

    function resize() {
      const hero = canvas.parentElement;
      w = canvas.width = hero.offsetWidth;
      h = canvas.height = hero.offsetHeight;
    }

    function createParticles() {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          r: Math.random() * PARTICLE_RADIUS + 0.5,
          opacity: Math.random() * 0.5 + 0.2,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      // Update particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Mouse repulsion
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          p.x += (dx / dist) * force * 2;
          p.y += (dy / dist) * force * 2;
        }

        // Wrap around edges
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
      }

      // Draw connections
      const theme = document.documentElement.getAttribute('data-theme') || 'dark';
      const lineColor = theme === 'dark' ? '255,255,255' : '0,0,0';

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DIST) {
            const opacity = (1 - dist / CONNECTION_DIST) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${lineColor},${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent').trim() || '#E84545';

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.08;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      requestAnimationFrame(draw);
    }

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    }

    function onMouseLeave() {
      mouseX = -1000;
      mouseY = -1000;
    }

    resize();
    createParticles();

    window.addEventListener('resize', () => {
      resize();
      createParticles();
    });

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    draw();
  }

  // ── Glossary Tooltips ───────────────────────────────────

  const GLOSSARY = {
    'in-camera': 'A parliamentary committee meeting closed to the public. The <code>&lt;InCameraNote/&gt;</code> field in the evidence XML is populated when proceedings go off the public record.',
    'influence-actor': 'An organization tracked for its ability to shape Canadian policy — international organizations (UN, NATO), think tanks (C.D. Howe, Fraser), consultancies (McKinsey, Deloitte), and NGOs (Oxfam, JCCF).',
    'sole-source': 'A government contract awarded to a single vendor without competitive bidding. Often flagged for higher risk of conflict of interest.',
    'signal': 'An automated detection that connects two or more data points across different sources — e.g., a company lobbying a department while holding a sole-source contract from that same department.',
    'entity-resolution': 'The process of identifying when the same person or organization appears across different data sources (committees, lobbying, procurement) and linking those records together.',
    'revolving-door': 'When a person moves between a government role and a lobbying or industry position, especially within a short time frame. Tracked as a conflict-of-interest signal.',
    'mcp': 'Model Context Protocol — an open standard that lets AI tools (ChatGPT, Claude, Gemini) connect to external data sources like CivInt through a common interface.',
    'pipeline': 'An automated data processing module that ingests, parses, and verifies records from a specific government source (e.g., the committees pipeline, lobbying pipeline).',
    'sweep': 'A scheduled run of the ingestion engine that collects new data from all sources, runs entity resolution, detects signals, and generates briefs.',
    'provenance': 'The verifiable chain of custody for a piece of data — from the original government source through ingestion, parsing, and citation hashing. Allows independent verification of any claim.',
    'citation': 'A SHA-256 content hash that uniquely identifies a specific record. Anyone can recompute the hash to verify the data hasn\'t been tampered with.',
    'cron-job': 'A scheduled task that runs automatically on the K3s cluster — e.g., daily committee ingestion runs at 6:00 AM UTC.',
    'in-camera-alert': 'A notification generated when a parliamentary committee meeting is flagged as in-camera (closed to the public). These are high-priority signals.',
    'lobbying': 'Communications between organizations and government officials aimed at influencing policy, legislation, or contracting decisions. Tracked by the Office of the Commissioner of Lobbying.',
    'procurement': 'The process by which the government purchases goods and services from private companies. CivInt tracks contract awards, sole-source designations, and vendor history.',
    'tier': 'Your CivInt subscription level (Free, Pro, Business) that determines API call limits, rate limits, and feature access.',
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

  // ── Init ────────────────────────────────────────────────────

  function init() {
    initTheme();
    setupThemeToggle();
    setupMobileMenu();
    setupScrollReveal();
    setupStatCounters();
    setupHeroCanvas();
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

})();
