/**
 * CivInt Data Stream — Matrix-style falling character columns
 * Include: <script src="assets/data-stream.js" defer></script>
 */
(function() {
'use strict';
if (window.__dataStreamLoaded) return;
window.__dataStreamLoaded = true;

// ─── Canvas ───
const canvas = document.getElementById('stream-canvas') || (() => {
  const c = document.createElement('canvas');
  c.id = 'stream-canvas';
  c.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;opacity:0.4;';
  document.body.prepend(c);
  return c;
})();
const ctx = canvas.getContext('2d');
let W, H, cols, fontSize = 14;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  cols = Math.ceil(W / (fontSize * 0.8));
}
resize();
window.addEventListener('resize', resize);

// ─── Character sets ───
const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';
const fallbackChars = '0123456789ABCDEFabcdef';

// ─── Column state ───
const drops = [];
for (let i = 0; i < cols; i++) {
  drops[i] = {
    y: Math.random() * -H,
    speed: 1 + Math.random() * 3,
    length: 5 + Math.random() * 20,
    flicker: Math.random() * 1000,
    trail: [],  // stores {char, alpha} for trailing characters
    active: true,
  };
}

// ─── Draw ───
function drawStreams(time) {
  ctx.fillStyle = 'rgba(11, 17, 32, 0.08)';  // fade trail
  ctx.fillRect(0, 0, W, H);

  // Use actual full-width katakana when available, fallback to hex
  const useKatakana = ctx.measureText('ア').width > 10;
  const set = useKatakana ? chars : fallbackChars;

  for (let i = 0; i < drops.length; i++) {
    const d = drops[i];
    if (!d.active) continue;

    const x = i * (fontSize * 0.8);
    
    // Head character (bright)
    const headIdx = Math.floor(Math.random() * set.length);
    const headChar = set[headIdx];
    
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 8;
    ctx.font = `${fontSize}px "JetBrains Mono", "Noto Sans JP", monospace`;
    ctx.fillStyle = `rgba(6, 182, 212, ${0.7 + 0.3 * Math.sin(time * 0.002 + i)})`;
    ctx.fillText(headChar, x, d.y);
    ctx.shadowBlur = 0;

    // Trail characters (fading)
    const trailLen = 12;
    for (let t = 1; t < trailLen; t++) {
      const ty = d.y - t * fontSize;
      if (ty < -fontSize || ty > H + fontSize) break;
      
      const trailAlpha = 0.5 * (1 - t / trailLen) * (0.5 + 0.5 * Math.sin(d.flicker + t * 0.5));
      if (trailAlpha < 0.01) break;
      
      const trailIdx = Math.floor(Math.random() * set.length);
      const trailChar = set[trailIdx];
      
      ctx.fillStyle = `rgba(6, 182, 212, ${trailAlpha})`;
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      ctx.fillText(trailChar, x, ty);
    }
    
    // Bright leading head
    const headBrightness = 0.9 + 0.1 * Math.sin(time * 0.003 + d.flicker);
    ctx.fillStyle = `rgba(232, 232, 255, ${headBrightness})`;
    ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
    ctx.fillText(headChar, x, d.y);

    // Move drop
    d.y += d.speed;
    d.flicker += 0.5;

    // Reset when off-screen
    if (d.y > H + d.length * fontSize) {
      d.y = -d.length * fontSize - Math.random() * 200;
      d.speed = 1 + Math.random() * 4;
      d.length = 5 + Math.random() * 25;
    }
  }
}

// ─── Ticker ───
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
  document.body.style.paddingTop = '22px';
}

// ─── Animate ───
function animate(time) {
  drawStreams(time);
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

console.log('[data-stream] Falling columns active');
})();
