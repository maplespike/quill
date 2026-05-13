/**
 * CivInt Data Stream — shared particle system, ticker, and effects
 * Include in any page with: <script src="assets/data-stream.js" defer></script>
 * Requires: <canvas id="stream-canvas"></canvas> element
 */
(function() {
'use strict';

// ─── Only run once ───
if (window.__dataStreamLoaded) return;
window.__dataStreamLoaded = true;

// ─── Canvas setup ───
const canvas = document.getElementById('stream-canvas') || (() => {
  const c = document.createElement('canvas');
  c.id = 'stream-canvas';
  c.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;opacity:0.5;';
  document.body.prepend(c);
  return c;
})();
const ctx = canvas.getContext('2d');
let W, H;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ─── Particles ───
const PARTICLE_COUNT = 80;
const particles = [];
const hexChars = '0123456789ABCDEF';

for (let i = 0; i < PARTICLE_COUNT; i++) {
  particles.push({
    x: Math.random() * 2000 - 200,
    y: Math.random() * H,
    vy: -(0.2 + Math.random() * 0.6),
    alpha: 0.08 + Math.random() * 0.25,
    pulse: Math.random() * Math.PI * 2,
    speed: 0.3 + Math.random() * 0.7,
    size: 0.6 + Math.random() * 1.4,
    char: hexChars[Math.floor(Math.random() * 16)],
  });
}

function drawParticles(time) {
  ctx.clearRect(0, 0, W, H);
  
  for (const p of particles) {
    p.x += Math.sin(time * 0.0008 + particles.indexOf(p)) * 0.2;
    p.y += p.vy * p.speed;
    p.pulse += 0.015;
    
    if (p.y < -30) { p.y = H + 30; p.x = Math.random() * W * 1.2; }
    if (p.x < -30) p.x = W + 30;
    if (p.x > W + 30) p.x = -30;
    
    const alpha = p.alpha * (0.4 + 0.6 * Math.sin(p.pulse));
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 3 * p.size;
    ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
    ctx.font = `${8 * p.size}px "JetBrains Mono", monospace`;
    ctx.fillText(p.char, p.x, p.y);
  }
  ctx.shadowBlur = 0;
  
  // Scan line
  const scanY = ((time * 0.03) % H);
  const grad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.5, 'rgba(232, 69, 69, 0.04)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, scanY - 30, W, 60);
}

// ─── Ticker (adds to body if not present) ───
if (!document.querySelector('.ci-ticker')) {
  const ticker = document.createElement('div');
  ticker.className = 'ci-ticker';
  ticker.innerHTML = `
    <style>
    .ci-ticker { position:fixed;top:0;left:0;right:0;z-index:1000;height:22px;overflow:hidden;
      background:rgba(11,17,32,0.88);backdrop-filter:blur(8px);
      border-bottom:1px solid rgba(232,69,69,0.12);pointer-events:none; }
    .ci-ticker-inner { display:flex;white-space:nowrap;animation:ciScroll 35s linear infinite; }
    .ci-ticker-item { display:inline-flex;align-items:center;gap:6px;padding:1px 16px;
      font-size:0.65rem;color:rgba(255,255,255,0.5);font-family:'JetBrains Mono',monospace; }
    .ci-ticker .dot { width:3px;height:3px;border-radius:50%;display:inline-block; }
    .ci-dot-gr { background:#10B981; } .ci-dot-rd { background:#E84545; }
    .ci-dot-cy { background:#06B6D4; } .ci-dot-am { background:#FBBF24; }
    @keyframes ciScroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
    </style>
    <div class="ci-ticker-inner">
      <span class="ci-ticker-item"><span class="dot ci-dot-gr"></span> Committees: 54 active</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-rd"></span> Lobbying spike detected</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-cy"></span> Canada Gazette updated</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-am"></span> OAG audit published</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-gr"></span> In-camera meeting flagged</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-rd"></span> Sole-source contract found</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-cy"></span> Ethics investigation opened</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-am"></span> Senate report released</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-gr"></span> CRTC decision published</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-rd"></span> Court ruling filed</span>
      <!-- Duplicate for seamless loop -->
      <span class="ci-ticker-item"><span class="dot ci-dot-gr"></span> Committees: 54 active</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-rd"></span> Lobbying spike detected</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-cy"></span> Canada Gazette updated</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-am"></span> OAG audit published</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-gr"></span> In-camera meeting flagged</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-rd"></span> Sole-source contract found</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-cy"></span> Ethics investigation opened</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-am"></span> Senate report released</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-gr"></span> CRTC decision published</span>
      <span class="ci-ticker-item"><span class="dot ci-dot-rd"></span> Court ruling filed</span>
    </div>`;
  document.body.prepend(ticker);
  // Push page content down by ticker height
  document.body.style.paddingTop = '22px';
}

// ─── Animate ───
function animate(time) {
  drawParticles(time);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// ─── Animated counters ───
window.animateCounter = function(el, target, duration = 1200) {
  const start = parseInt(el.textContent) || 0;
  const startTime = performance.now();
  function tick(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
};

console.log('[data-stream] Active');
})();
