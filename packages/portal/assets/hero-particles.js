/**
 * MapleSpike Hero Background — interactive particle system.
 *
 * Lightweight Canvas2D particles with mouse interaction.
 * Canadian red + gold palette. Zero dependencies.
 *
 * Particles drift slowly upward, react to mouse proximity,
 * and form a subtle data-flow visual in the hero background.
 */

(function() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  // Create canvas overlay
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  canvas.width = hero.offsetWidth;
  canvas.height = hero.offsetHeight;
  hero.style.position = 'relative';
  hero.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let mouseX = -1000, mouseY = -1000;
  let animId = null;
  let particles = [];

  // Resize handler
  function resize() {
    canvas.width = hero.offsetWidth;
    canvas.height = hero.offsetHeight;
    initParticles();
  }

  // Particle class
  class Particle {
    constructor(w, h) {
      this.reset(w, h, true);
    }
    reset(w, h, initial) {
      this.x = Math.random() * w;
      this.y = initial ? Math.random() * h : h + 20;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -(0.2 + Math.random() * 0.4);
      this.size = 1 + Math.random() * 2;
      // Color: mix of red (#C23030), gold (#D4A017), and cyan (#0891B2)
      const colors = [
        { r: 194, g: 48, b: 48 },   // red
        { r: 212, g: 160, b: 23 },   // gold
        { r: 8, g: 145, b: 178 },    // cyan
      ];
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.color = `rgba(${c.r},${c.g},${c.b},${0.15 + Math.random() * 0.25})`;
      this.baseVx = this.vx;
      this.baseVy = this.vy;
      this.w = w;
      this.h = h;
    }
    update(w, h) {
      this.w = w;
      this.h = h;

      // Mouse interaction: particles move away from cursor
      if (mouseX > 0 && mouseY > 0) {
        const dx = this.x - mouseX;
        const dy = this.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          const force = (200 - dist) / 200 * 0.8;
          this.vx += (dx / dist) * force * 0.05;
          this.vy += (dy / dist) * force * 0.05;
        }
      }

      // Return to base velocity
      this.vx += (this.baseVx - this.vx) * 0.01;
      this.vy += (this.baseVy - this.vy) * 0.01;

      this.x += this.vx;
      this.y += this.vy;

      // Wrap around
      if (this.y < -20) this.reset(w, h, false);
      if (this.x < -20) this.x = w + 20;
      if (this.x > w + 20) this.x = -20;
    }
    draw(ctx) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }

  function initParticles() {
    const count = Math.min(80, Math.floor(canvas.width * canvas.height / 12000));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(canvas.width, canvas.height));
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.update(canvas.width, canvas.height);
      p.draw(ctx);
    }
    animId = requestAnimationFrame(animate);
  }

  // Mouse tracking
  document.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  document.addEventListener('mouseleave', () => {
    mouseX = -1000;
    mouseY = -1000;
  });

  // Touch support
  document.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const rect = hero.getBoundingClientRect();
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
  }, { passive: true });

  document.addEventListener('touchend', () => {
    mouseX = -1000;
    mouseY = -1000;
  });

  // Resize observer
  const ro = new ResizeObserver(() => resize());
  ro.observe(hero);

  // Start
  initParticles();
  animate();
})();
