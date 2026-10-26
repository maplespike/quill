import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const portal = join(__dirname, '..');
const publicDir = join(portal, 'public');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('public sitemap and robots host', () => {
  const robots = read(join(publicDir, 'robots.txt'));
  const sitemap = read(join(publicDir, 'sitemap.xml'));

  test('robots.txt names the Quill sitemap', () => {
    expect(robots).toMatch(/^Sitemap: https:\/\/quill\.maplespike\.ca\/sitemap\.xml$/m);
    expect(robots).not.toContain('https://maplespike.ca/');
    expect(robots).not.toContain('docs.maplespike.ca');
  });

  test('sitemap.xml uses https://quill.maplespike.ca for every URL', () => {
    const locs = [
      ...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g),
    ].map((match) => match[1]);
    const alternates = [
      ...sitemap.matchAll(/<xhtml:link\b[^>]*\bhref="([^"]+)"/g),
    ].map((match) => match[1]);
    expect(locs.length).toBeGreaterThan(10);
    expect(alternates.length).toBe(locs.length);
    for (const loc of [...locs, ...alternates]) {
      expect(loc.startsWith('https://quill.maplespike.ca/')).toBe(true);
    }
    expect(sitemap).not.toContain('https://maplespike.ca/');
    expect(sitemap).not.toContain('docs.maplespike.ca');
    expect(sitemap).toContain('https://quill.maplespike.ca/api-reference');
    expect(sitemap).toContain('https://quill.maplespike.ca/docs');
  });
});

describe('documentation links use a host that serves docs', () => {
  const files = [
    join(portal, '../../scripts/build-docs.mjs'),
    join(portal, '../sdk-python/pyproject.toml'),
    join(portal, '../sdk-python/quill/__init__.py'),
    join(portal, '../sdk-python/quill/mock.py'),
    join(portal, 'src/layouts/BaseLayout.astro'),
    join(portal, 'src/pages/docs.astro'),
  ];

  test('does not point readers at docs.maplespike.ca or the apex /docs path', () => {
    for (const file of files) {
      const text = read(file);
      expect(text, file).not.toContain('docs.maplespike.ca');
      expect(text, file).not.toContain('https://maplespike.ca/docs');
    }
  });
});
