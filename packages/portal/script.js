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

  // ── Init ────────────────────────────────────────────────────

  function init() {
    initTheme();
    setupThemeToggle();
    setupMobileMenu();
    setupScrollReveal();
    setupStatCounters();
    setupHeroCanvas();
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
