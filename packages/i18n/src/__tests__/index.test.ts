import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n } from '../index.js';
import { detectLocale, localizePath } from '../detect.js';
import { formatCurrency, formatDate, formatNumber, formatRelativeDate } from '../formatters.js';

describe('createI18n', () => {
  it('returns English strings', () => {
    const i18n = createI18n('en');
    assert.equal(i18n.t('nav.home'), 'Home');
    assert.equal(i18n.t('auth.login'), 'Log In');
  });

  it('returns French strings when available', () => {
    const i18n = createI18n('fr');
    assert.equal(i18n.t('nav.home'), 'Accueil');
    assert.equal(i18n.t('auth.login'), 'Connexion');
  });

  it('returns the key itself if neither locale has it', () => {
    const i18n = createI18n('en');
    assert.equal(i18n.t('nonexistent.key' as any), 'nonexistent.key');
  });

  it('returns correct lang property', () => {
    assert.equal(createI18n('en').lang, 'en');
    assert.equal(createI18n('fr').lang, 'fr');
  });
});

describe('detectLocale', () => {
  it('detects French from path', () => {
    assert.equal(detectLocale({ path: '/fr/dashboard' }), 'fr');
    assert.equal(detectLocale({ path: '/fr/' }), 'fr');
    assert.equal(detectLocale({ path: '/fr' }), 'fr');
  });

  it('detects English from path', () => {
    assert.equal(detectLocale({ path: '/en/dashboard' }), 'en');
    assert.equal(detectLocale({ path: '/en/' }), 'en');
    assert.equal(detectLocale({ path: '/en' }), 'en');
  });

  it('detects from cookie', () => {
    assert.equal(detectLocale({ cookie: 'fr' }), 'fr');
    assert.equal(detectLocale({ cookie: 'en' }), 'en');
  });

  it('detects French from Accept-Language', () => {
    assert.equal(detectLocale({ acceptLanguage: 'fr-CA,fr;q=0.9' }), 'fr');
  });

  it('detects English from Accept-Language', () => {
    assert.equal(detectLocale({ acceptLanguage: 'en-US,en;q=0.9,fr;q=0.5' }), 'en');
  });

  it('falls back to default', () => {
    assert.equal(detectLocale({}), 'en');
    assert.equal(detectLocale({ default: 'fr' }), 'fr');
  });

  it('path takes priority over cookie', () => {
    assert.equal(detectLocale({ path: '/en/', cookie: 'fr' }), 'en');
    assert.equal(detectLocale({ path: '/fr/', cookie: 'en' }), 'fr');
  });
});

describe('localizePath', () => {
  it('adds /en/ prefix for English', () => {
    assert.equal(localizePath('/dashboard', 'en'), '/en/dashboard');
  });

  it('adds /fr/ prefix + translates route for French', () => {
    const routes = { '/dashboard': '/tableau-de-bord' };
    assert.equal(localizePath('/dashboard', 'fr', routes), '/fr/tableau-de-bord');
  });

  it('strips existing language prefix', () => {
    assert.equal(localizePath('/en/dashboard', 'en'), '/en/dashboard');
    const routes = { '/dashboard': '/tableau-de-bord' };
    assert.equal(localizePath('/en/dashboard', 'fr', routes), '/fr/tableau-de-bord');
  });

  it('handles root path', () => {
    assert.equal(localizePath('/', 'en'), '/en');
    assert.equal(localizePath('/', 'fr'), '/fr');
  });
});

describe('formatCurrency', () => {
  it('formats en-CA correctly', () => {
    const result = formatCurrency(50, 'en');
    assert.ok(result.includes('CAD'));
    assert.ok(result.includes('50'));
  });

  it('formats fr-CA correctly', () => {
    const result = formatCurrency(50, 'fr');
    assert.ok(result.includes('$'));
    assert.ok(result.includes('50'));
    assert.ok(result.includes('CA'));
  });
});

describe('formatDate', () => {
  it('formats short date en-CA', () => {
    const result = formatDate(new Date('2026-07-02'), 'en', 'short');
    assert.ok(result.includes('2026'));
  });

  it('formats short date fr-CA', () => {
    const result = formatDate(new Date('2026-07-02'), 'fr', 'short');
    assert.ok(result.includes('2026'));
    assert.ok(result.includes('juill'));
  });

  it('formats long date fr-CA', () => {
    const result = formatDate(new Date('2026-07-02'), 'fr', 'long');
    assert.ok(result.includes('juillet'));
  });

  it('accepts string dates', () => {
    const result = formatDate('2026-07-02', 'en');
    assert.ok(result.includes('2026'));
  });
});

describe('formatNumber', () => {
  it('formats en-CA with thousands separator', () => {
    assert.equal(formatNumber(1234.56, 'en'), '1,234.56');
  });

  it('formats fr-CA with space separator', () => {
    const result = formatNumber(1234.56, 'fr');
    assert.ok(result.includes('1'));
    assert.ok(result.includes('234'));
    assert.ok(result.includes('56'));
  });
});

describe('formatRelativeDate', () => {
  it('returns "Today" for today', () => {
    assert.equal(formatRelativeDate(new Date(), 'en'), 'Today');
  });

  it('returns "Aujourd\'hui" for today in French', () => {
    assert.equal(formatRelativeDate(new Date(), 'fr'), 'Aujourd\'hui');
  });
});
