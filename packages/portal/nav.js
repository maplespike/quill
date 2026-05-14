// ─── MapleSpike Shared Nav Logic ───────────────────────────
// Theme toggle, mobile menu, scroll-reveal — included on every page.

(function() {
'use strict';

const LS_THEME = 'maplespike-theme';

// ── Theme ──
function initTheme() {
  const saved = localStorage.getItem(LS_THEME);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = theme === 'dark' ? '\u{1F319}' : '\u{2600}\u{FE0F}';
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(LS_THEME, next);
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = next === 'dark' ? '\u{1F319}' : '\u{2600}\u{FE0F}';
  });
}

function setupThemeToggle() {
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
}

// ── Mobile Menu ──
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
    isOpen ? closeMenu() : openMenu();
  });

  // Close on link click
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', closeMenu);
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && links.classList.contains('open')) closeMenu();
  });
}

// ── Scroll-reveal (IntersectionObserver) ──
function setupScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  const els = document.querySelectorAll('[data-reveal]');
  if (!els.length) return;

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.15 });

  for (const el of els) observer.observe(el);
}

// ── Nav shrink-on-scroll ──
function setupNavScroll() {
  const nav = document.querySelector('nav');
  if (!nav) return;
  let ticking = false;

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.classList.toggle('scrolled', window.scrollY > 40);
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  // Check initial state
  if (window.scrollY > 40) nav.classList.add('scrolled');
}

// ── Boot ──
function boot() {
  initTheme();
  setupThemeToggle();
  setupMobileMenu();
  setupScrollReveal();
  setupNavScroll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

})();
