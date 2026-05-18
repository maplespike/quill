/**
 * MapleSpike Data Stream — Matrix-style falling character columns
 * Include: <script src="assets/data-stream.js" defer></script>
 *
 * Does NOT add ticker — ticker is embedded in each page's HTML directly
 * for proper layout control (no z-index/position fighting with nav).
 */
(function() {
'use strict';
if (window.__dataStreamLoaded) return;
window.__dataStreamLoaded = true;

const canvas = document.getElementById('stream-canvas') || (() => {
  const c = document.createElement('canvas');
  c.id = 'stream-canvas';
  c.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;opacity:0.2;';
  document.body.prepend(c);
  return c;
})();
const ctx = canvas.getContext('2d');
let W, H, fontSize = 13;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// Character set — katakana + hex
const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';
const fallback = '0123456789ABCDEFabcdef';

// Columns
const cols = Math.ceil(W / 22);  // ~half as many columns
const drops = [];
for (let i = 0; i < cols; i++) {
  drops[i] = {
    y: Math.random() * -H * 3,
    speed: 0.4 + Math.random() * 1.2,
    length: 3 + Math.random() * 10,
    flicker: Math.random() * 1000,
  };
}

// Use katakana if they render wider than hex (indicating font support)
let useWide = false;
function fontSupported() { useWide = ctx.measureText('ア').width > 10; }
fontSupported();

function drawStreams(time) {
  // Fade trail — very subtle
  ctx.fillStyle = 'rgba(11, 17, 32, 0.06)';
  ctx.fillRect(0, 0, W, H);

  const set = useWide ? chars : fallback;
  ctx.font = `${fontSize}px "JetBrains Mono", "Noto Sans JP", monospace`;

  for (let i = 0; i < drops.length; i++) {
    const d = drops[i];
    const x = i * 11;

    // Head char (brightest)
    const headChar = set[Math.floor(Math.random() * set.length)];
    d.flicker += 0.4;

    // Glow on head
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 4;
    ctx.fillStyle = `rgba(6, 182, 212, ${0.3 + 0.2 * Math.sin(time * 0.002 + i)})`;
    ctx.fillText(headChar, x, d.y);
    ctx.shadowBlur = 0;

    // Trail
    for (let t = 1; t < Math.min(d.length, 10); t++) {
      const ty = d.y - t * fontSize;
      if (ty < -fontSize || ty > H + fontSize) break;
      const alpha = 0.2 * (1 - t / 10);
      if (alpha < 0.01) break;
      const trailChar = set[Math.floor(Math.random() * set.length)];
      ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
      ctx.fillText(trailChar, x, ty);
    }

    // Bright white head
    ctx.fillStyle = `rgba(232, 240, 255, ${0.6 + 0.2 * Math.sin(time * 0.003 + d.flicker)})`;
    ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
    ctx.fillText(headChar, x, d.y);
    ctx.font = `${fontSize}px "JetBrains Mono", "Noto Sans JP", monospace`;

    d.y += d.speed;
    if (d.y > H + d.length * fontSize) {
      d.y = -d.length * fontSize - Math.random() * 300;
      d.speed = 0.8 + Math.random() * 3;
      d.length = 4 + Math.random() * 20;
    }
  }
}

// Animate
function animate(time) {
  drawStreams(time);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Animated counters (exposed globally)
window.animateCounter = function(el, target, duration = 1200) {
  const start = parseInt(el.textContent) || 0;
  const t0 = performance.now();
  function tick(now) {
    const t = Math.min((now - t0) / duration, 1);
    el.textContent = Math.round(start + (target - start) * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
};
})();
