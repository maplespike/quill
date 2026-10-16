import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const server = readFileSync(join(__dirname, '..', 'server.py'), 'utf8');

function directive(csp: string, name: string): string {
  const match = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `));
  return match ?? '';
}

// Extract the CSP string literal assigned to QuillHandler.CSP (concatenated Python string pieces).
const cspMatch = server.match(/CSP = \(([\s\S]*?)\n    \)/);
const csp = cspMatch
  ? [...cspMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join('')
  : '';

describe('server.py Content-Security-Policy', () => {
  test('is present', () => {
    expect(csp.length).toBeGreaterThan(0);
  });

  test('allows Stripe embedded checkout scripts, frames and API calls', () => {
    expect(directive(csp, 'script-src')).toContain('https://js.stripe.com');
    expect(directive(csp, 'frame-src')).toContain('https://js.stripe.com');
    expect(directive(csp, 'frame-src')).toContain('https://hooks.stripe.com');
    expect(directive(csp, 'connect-src')).toContain('https://api.stripe.com');
  });

  test('no longer allows retired Google Fonts origins', () => {
    expect(csp).not.toContain('fonts.googleapis.com');
    expect(csp).not.toContain('fonts.gstatic.com');
    expect(directive(csp, 'font-src')).toBe("font-src 'self'");
  });
});
