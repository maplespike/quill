import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const layout = read('src/layouts/BaseLayout.astro');
const landing = read('src/components/LandingBody.astro');
const header = read('src/components/SiteHeader.astro');
const css = read('src/styles/editorial.css');

describe('Public Record design contracts', () => {
  test('every route gets the same local-font theme and one main landmark', () => {
    expect(layout).toContain('data-theme="ink-and-paper" class="theme-ink-and-paper"');
    expect(layout).not.toContain('fonts.googleapis.com');
    expect(layout.match(/<main\b/g)).toHaveLength(1);
    expect(layout).toContain('id="main-content" tabindex="-1"');
    expect(layout).toContain('<SiteHeader ');
    expect(header).toContain('id="nav-auth-container"');
  });

  test('header supports keyboard dismissal and idempotent SPA binding', () => {
    expect(header).toContain('href="#main-content"');
    expect(header).toContain('aria-controls="mobile-nav"');
    expect(header).toContain('toggle.dataset.menuBound');
    expect(header).toContain("event.key === 'Escape'");
    expect(header).toContain("document.addEventListener('astro:page-load', setupNavigation)");
    expect(header).toContain('no-js-navigation');
    expect(css).not.toMatch(/header-scrolled[\s\S]*opacity:\s*0/);
  });

  test('landing search and source directory use the existing query interface', () => {
    expect(landing).toContain('action={url(\'/explorer\')} method="GET"');
    expect(landing).toContain('name="query"');
    expect(landing).toContain('?query=${encodeURIComponent(category.query)}');
    expect(landing).not.toContain('?category=');
    expect(landing).toContain('https://mcp.maplespike.ca/sse');
    expect(landing).toContain('https://api.maplespike.ca/v1/gov/search');
    expect(landing).toContain('data-error-label');
    expect(landing).toContain('role="status" aria-live="polite"');
  });

  test('content visibility does not depend on animation or JavaScript', () => {
    expect(css).toMatch(/\.theme-ink-and-paper \.reveal-on-scroll,[\s\S]*?opacity:\s*1/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.docs-content [data-slot="card-content"] { overflow-x: auto; }');
    expect(css).not.toMatch(/(?:html|body)\s*\{[^}]*overflow-x:\s*hidden/);
  });

  test('Astro pages pass React styling through className', () => {
    const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : path.endsWith('.astro') ? [path] : [];
    });
    for (const path of walk(join(process.cwd(), 'src/pages'))) {
      const source = readFileSync(path, 'utf8');
      expect(source, `${path} passes class instead of className to a component`).not.toMatch(/<[A-Z][A-Za-z]*\b[^<>]*?\bclass=/);
    }
  });

  test('artwork is explicitly decorative with a reproducible local workflow', () => {
    expect(landing).toMatch(/<img[^>]+public-record\.webp[^>]+alt=""/);
    const provenance = JSON.parse(read('public/assets/public-record-art.json'));
    expect(provenance.model).toBe('epicrealismXL_pureFix.safetensors');
    expect(provenance.seed).toBe(10902026);
    expect(provenance.workflow['7'].class_type).toBe('SaveImage');
    expect(provenance.purpose).toContain('Not a map');
  });
});
