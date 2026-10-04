/**
 * Global auth state manager — shared across all pages.
 * Injects auth-aware UI into the navbar and exposes auth state to any component.
 *
 * Loaded via BaseLayout <script is:inline> so it runs before React hydration.
 * Components read from window.QuillAuth.
 */

(function () {
  const TOKEN_KEY = "maplespike_token";
  const USER_KEY = "maplespike_userId";
  const METHOD_KEY = "maplespike_method";
  const API_KEY = "quill-api-key";
  const OIDC_KEY = "maplespike_oidc_token";

  function getAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    const userId = localStorage.getItem(USER_KEY);
    const method = localStorage.getItem(METHOD_KEY);
    return { token, userId, method, isAuthenticated: !!token || method === "passkey" };
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(METHOD_KEY);
    localStorage.removeItem(API_KEY);
    localStorage.removeItem(OIDC_KEY);
  }

  function updateNav() {
    const auth = getAuth();
    const navAuth = document.getElementById("nav-auth-container");
    if (!navAuth) return;

    if (auth.isAuthenticated) {
      const methodIcon =
        auth.method === "web3" ? "⛓" :
        auth.method === "passkey" ? "🔑" :
        auth.method === "oauth" ? "✓" : "●";
      const shortId = auth.userId
        ? (auth.userId.startsWith("0x")
          ? auth.userId.slice(0, 6) + "..." + auth.userId.slice(-4)
          : auth.userId.slice(0, 8) + "...")
        : "Account";
      navAuth.innerHTML = `
        <div class="relative" id="nav-account-menu">
          <button id="nav-account-btn"
            class="inline-flex h-9 items-center gap-2 rounded-full border border-border/60 bg-card/30 px-3 text-sm font-medium transition-colors hover:bg-foreground/[0.04]">
            <span class="text-base">${methodIcon}</span>
            <span class="hidden sm:inline">${shortId}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-50"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div id="nav-account-dropdown"
            class="absolute right-0 top-11 hidden w-56 rounded-xl border border-border/60 bg-card/95 p-2 backdrop-blur-xl shadow-xl z-50">
            <div class="px-3 py-2 border-b border-border/40 mb-1">
              <div class="text-xs text-muted-foreground">Signed in via</div>
              <div class="text-sm font-medium capitalize">${auth.method || "API key"}</div>
            </div>
            <a href="/dashboard" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
              Dashboard
            </a>
            <a href="/dashboard#keys" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              API Keys
            </a>
            <button id="nav-logout-btn"
              class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
              Sign out
            </button>
          </div>
        </div>
      `;
      // Dropdown toggle
      const btn = document.getElementById("nav-account-btn");
      const dd = document.getElementById("nav-account-dropdown");
      if (btn && dd) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          dd.classList.toggle("hidden");
        });
        document.addEventListener("click", () => dd.classList.add("hidden"));
      }
      // Logout
      const logout = document.getElementById("nav-logout-btn");
      if (logout) {
        logout.addEventListener("click", () => {
          clearAuth();
          window.location.href = "/";
        });
      }
    } else {
      navAuth.innerHTML = `
        <a href="/signup"
          class="btn-sheen inline-flex h-9 items-center rounded-full px-5 text-sm font-medium text-primary-foreground transition-colors">
          Sign in
        </a>
      `;
    }
  }

  // Expose globally
  window.QuillAuth = {
    getAuth,
    clearAuth,
    isAuthenticated: () => getAuth().isAuthenticated,
    getToken: () => localStorage.getItem(TOKEN_KEY),
    getUserId: () => localStorage.getItem(USER_KEY),
    setAuth: (token, userId, method) => {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, userId);
      localStorage.setItem(METHOD_KEY, method);
      updateNav();
    },
    logout: () => {
      clearAuth();
      updateNav();
    },
    updateNav,
  };

  // Update nav on page load and on view transitions
  document.addEventListener("astro:page-load", updateNav);
  if (document.readyState !== "loading") {
    updateNav();
  } else {
    document.addEventListener("DOMContentLoaded", updateNav);
  }
})();
