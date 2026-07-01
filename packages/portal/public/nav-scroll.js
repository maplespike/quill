/* ══════════════════════════════════════════════════════════════════
   MapleSpike — Shared Scroll-Shrink Utility
   Toggles a CSS class on a target element when the user scrolls
   past a configurable threshold. Uses requestAnimationFrame for
   jank-free performance.

   Used by:
     • public/index.html (static landing page <nav>)
     • Astro BaseLayout (sticky <header> via inline call)

   Usage:
     // Configure then start
     navScroll.start({ selector: 'nav', threshold: 40, className: 'scrolled' });

     // Clean up (e.g. on Astro page transition / SPA nav)
     navScroll.destroy();
   ══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Exported API ────────────────────────────────────────────

  window.navScroll = {
    /**
     * Start watching scroll and toggling the given class on the
     * first element matching `selector`.
     *
     * @param {object} [opts]
     * @param {string} [opts.selector='nav, header']  CSS selector for the target element(s)
     * @param {number} [opts.threshold=40]            scrollY threshold in px
     * @param {string} [opts.className='scrolled']    class to toggle
     * @returns {HTMLElement|null} the element that was found, or null
     */
    start: function (opts) {
      opts = opts || {};

      var selector    = opts.selector    || 'nav, header';
      var threshold   = opts.threshold   || 40;
      var className   = opts.className   || 'scrolled';

      // Clean up any previous instance
      this.destroy();

      this._el        = document.querySelector(selector);
      this._threshold = threshold;
      this._className = className;
      this._ticking   = false;

      if (!this._el) return null;

      var self = this;

      function onScroll() {
        if (!self._ticking) {
          requestAnimationFrame(function () {
            var isPast = window.scrollY > self._threshold;
            self._el.classList.toggle(self._className, isPast);
            self._ticking = false;
          });
          self._ticking = true;
        }
      }

      this._handler = onScroll;
      window.addEventListener('scroll', onScroll, { passive: true });

      // Apply initial state
      if (window.scrollY > threshold) {
        this._el.classList.add(className);
      }

      return this._el;
    },

    /**
     * Remove the scroll listener and any toggled class.
     */
    destroy: function () {
      if (this._handler) {
        window.removeEventListener('scroll', this._handler);
        this._handler = null;
      }
      if (this._el) {
        this._el.classList.remove(this._className);
        this._el = null;
      }
      this._ticking = false;
    }
  };
})();
