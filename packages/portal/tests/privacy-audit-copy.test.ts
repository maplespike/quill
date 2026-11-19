import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const privacy = readFileSync(join(__dirname, '..', 'src', 'pages', 'privacy.astro'), 'utf8');

describe('privacy notice matches the edge AI audit', () => {
  test('names the stored fields in English and French', () => {
    expect(privacy).toContain('tenant ID');
    expect(privacy).toContain("identifiant du locataire");
    expect(privacy).toContain('client IP address');
    expect(privacy).toContain("adresse IP du client");
    expect(privacy).toContain('user agent');
    expect(privacy).toContain('agent utilisateur');
    expect(privacy).toContain('SHA-256 hash of the API key');
    expect(privacy).toContain('hachage SHA-256 de la clé API');
    expect(privacy).toContain('request hash');
    expect(privacy).toContain('hachage de la requête');
  });

  test('does not call the request hash anonymous', () => {
    expect(privacy).toContain('The request hash is not anonymous.');
    expect(privacy).toContain("Le hachage de la requête n'est pas anonyme.");
    expect(privacy).not.toMatch(/request hash is anonymous/i);
    expect(privacy).not.toMatch(/hachage de la requête est anonyme/i);
    expect(privacy).not.toContain('not stored permanently');
    expect(privacy).not.toContain('No query content is stored');
  });

  test('states the 30-day retention and the processors', () => {
    expect(privacy).toContain('AUDIT_RETENTION_DAYS');
    expect(privacy).toContain('30 days');
    expect(privacy).toContain('30 jours');
    expect(privacy).toContain('Cloudflare Workers AI');
    expect(privacy).toContain('Cloudflare AI Gateway');
    expect(privacy).toContain('Cloudflare D1');
    expect(privacy).toContain('homelab');
    expect(privacy).toContain('laboratoire maison');
  });
});
