import { Link } from "@tanstack/react-router";
import { Mark } from "@/components/landing/mark";
import { SITE } from "@/lib/plans";

const PRODUCT = [
  { to: "/explorer", label: "Explorer" },
  { to: "/coverage", label: "Coverage" },
  { to: "/signal", label: "Signal" },
  { to: "/watcher", label: "Watcher" },
  { to: "/ask", label: "Ask" },
  { to: "/pricing", label: "Pricing" },
] as const;

const WORK = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/workspace", label: "Workspace" },
  { to: "/signup", label: "Signup" },
  { to: "/contact", label: "Contact" },
] as const;

const BUILD = [
  { to: "/docs", label: "Docs" },
  { to: "/mcp", label: "MCP" },
  { to: "/agents", label: "Agents" },
  { to: "/api-explorer", label: "API explorer" },
  { to: "/citation", label: "Verify a hash" },
  { to: "/status", label: "Status" },
  { to: "/changelog", label: "Changelog" },
] as const;

const ABOUT = [
  { to: "/blog", label: "Blog" },
  { to: "/fr", label: "Français" },
  { to: "/style", label: "Style guide" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
] as const;

const linkClass = "inline-flex min-h-11 items-center text-sm text-on-ink-muted hover:text-on-ink";

export function Footer() {
  return (
    <footer className="border-t border-on-ink-line bg-ink text-on-ink">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Link to="/" className="inline-flex min-h-11 items-center gap-2.5 text-on-ink">
            <Mark nib="ink" />
            <span className="font-display text-xl leading-none">{SITE.name}</span>
          </Link>
          <p className="mt-3 max-w-sm text-sm text-on-ink-muted">
            {SITE.org}. Canada's sovereign, AI-native government data pipeline.
          </p>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-1">
          <p className="font-mono text-xs uppercase tracking-widest text-on-ink-muted">Product</p>
          {PRODUCT.map((link) => (
            <Link key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Work" className="flex flex-col gap-1">
          <p className="font-mono text-xs uppercase tracking-widest text-on-ink-muted">Work</p>
          {WORK.map((link) => (
            <Link key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Build" className="flex flex-col gap-1">
          <p className="font-mono text-xs uppercase tracking-widest text-on-ink-muted">Build</p>
          {BUILD.map((link) => (
            <Link key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="About" className="flex flex-col gap-1">
          <p className="font-mono text-xs uppercase tracking-widest text-on-ink-muted">About</p>
          {ABOUT.map((link) => (
            <Link key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </Link>
          ))}
          <a className={linkClass} href={SITE.url}>
            quill.maplespike.ca
          </a>
          <a className={linkClass} href={SITE.github}>
            GitHub
          </a>
        </nav>
      </div>
      <div className="border-t border-on-ink-line">
        <p className="mx-auto max-w-6xl px-5 py-6 text-xs text-on-ink-muted sm:px-8">
          Pipeline-core is AGPL-3.0. The MCP server, engine, and portal are MIT. Public data keeps
          its own licence, mostly the Open Government Licence – Canada.
        </p>
      </div>
    </footer>
  );
}
