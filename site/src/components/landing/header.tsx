import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/landing/mark";
import { SITE } from "@/lib/plans";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/explorer", label: "Explorer" },
  { to: "/agents", label: "Agents" },
  { to: "/ask", label: "Ask" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/pricing", label: "Pricing" },
  { to: "/docs", label: "Docs" },
] as const;

const item =
  "inline-flex min-h-11 items-center rounded-control px-2.5 text-sm hover:text-ink";

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-paper",
        scrolled ? "border-line" : "border-transparent",
      )}
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-control focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <Link to="/" className="flex min-h-11 items-center gap-2.5 text-ink">
          <Mark />
          <span className="font-display text-xl leading-none tracking-tight">{SITE.name}</span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Site">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`${item} text-muted`}
              activeProps={{ className: `${item} text-ink` }}
              inactiveProps={{ className: `${item} text-muted` }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild className="hidden sm:inline-flex">
            <Link to="/" hash="access">
              Request access
            </Link>
          </Button>
          <div className="hidden items-center gap-2 font-mono text-xs sm:flex">
            <Link to="/" className="text-ink">
              EN
            </Link>
            <Link to="/fr" className="text-muted hover:text-ink">
              FR
            </Link>
          </div>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-control border border-line text-ink lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Site"
          className="absolute inset-x-0 top-full border-b border-line bg-paper px-5 py-3 lg:hidden"
        >
          <ul className="flex flex-col">
            {LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="flex min-h-11 items-center text-base text-ink"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="flex min-h-11 items-center gap-4 font-mono text-xs">
                <Link to="/" onClick={() => setOpen(false)}>
                  EN
                </Link>
                <Link to="/fr" className="text-muted" onClick={() => setOpen(false)}>
                  FR
                </Link>
              </li>
            <li className="pt-2 sm:hidden">
              <Button asChild className="w-full">
                <Link to="/" hash="access" onClick={() => setOpen(false)}>
                  Request access
                </Link>
              </Button>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
