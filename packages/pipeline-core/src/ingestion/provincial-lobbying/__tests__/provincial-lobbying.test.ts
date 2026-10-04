/**
 * Provincial Lobbying Tests — Quill
 *
 * Tests for constants, types, and parser normalizers across all 9 new
 * provincial/territorial lobbying modules.
 *
 * Run: node --test --import tsx
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

describe('provincial lobbying constants', () => {
  it('SASKATCHEWAN_LOBBYING has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.SASKATCHEWAN_LOBBYING.BASE,
      'https://www.sasklobbyistregistry.ca/',
    );
    assert.equal(
      mod.SASKATCHEWAN_LOBBYING.SEARCH,
      'https://www.sasklobbyistregistry.ca/search-the-registry/',
    );
  });

  it('MANITOBA_LOBBYING has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.MANITOBA_LOBBYING.BASE,
      'https://www.lobbyistregistrar.mb.ca/',
    );
    assert.ok(mod.MANITOBA_LOBBYING.SEARCH);
  });

  it('NOVA_SCOTIA_LOBBYING has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.NOVA_SCOTIA_LOBBYING.BASE,
      'https://novascotia.ca/sns/Lobbyist/',
    );
    assert.ok(mod.NOVA_SCOTIA_LOBBYING.SEARCH);
  });

  it('NEW_BRUNSWICK_LOBBYING has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.NEW_BRUNSWICK_LOBBYING.BASE,
      'https://www.oic-bci.ca/',
    );
    assert.equal(
      mod.NEW_BRUNSWICK_LOBBYING.REGISTRY_NAME,
      'New Brunswick Lobbyists Registry',
    );
  });

  it('NEWFOUNDLAND_LOBBYING has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.NEWFOUNDLAND_LOBBYING.BASE,
      'https://www.gov.nl.ca/gs/registries/lobbyists/',
    );
    assert.ok(mod.NEWFOUNDLAND_LOBBYING.SEARCH);
  });

  it('PEI_LOBBYING has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.PEI_LOBBYING.BASE,
      'https://www.princeedwardisland.ca/en/feature/lobbyist-registry',
    );
    assert.equal(mod.PEI_LOBBYING.SEARCH, mod.PEI_LOBBYING.BASE);
  });

  it('YUKON_LOBBYING has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.YUKON_LOBBYING.BASE,
      'https://yukonlobbyistregistry.ca/',
    );
    assert.ok(mod.YUKON_LOBBYING.SEARCH);
  });

  it('NWT_LOBBYING has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.NWT_LOBBYING.BASE,
      'https://www.gov.nt.ca/',
    );
    assert.equal(mod.NWT_LOBBYING.SEARCH, '');
    assert.ok(mod.NWT_LOBBYING.NOTE);
  });

  it('NUNAVUT_LOBBYING has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.NUNAVUT_LOBBYING.BASE,
      'https://www.gov.nu.ca/',
    );
    assert.equal(mod.NUNAVUT_LOBBYING.SEARCH, 'https://lobbycanada.gc.ca/app/secure/ocl/lrs/do/advSrch');
    assert.ok(mod.NUNAVUT_LOBBYING.NOTE);
  });

  it('ONTARIO_LOBBYING still has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.ONTARIO_LOBBYING.BASE,
      'https://lobbyist.oico.on.ca/lobbyistregistry/',
    );
  });

  it('BC_LOBBYING still has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.BC_LOBBYING.BASE,
      'https://lobbyists.bc.ca/',
    );
  });

  it('ALBERTA_LOBBYING still has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.ALBERTA_LOBBYING.BASE,
      'https://www.albertalobbyistregistry.ca/',
    );
  });

  it('QUEBEC_LOBBYING still has correct BASE URL', async () => {
    const mod = await import('../constants.js');
    assert.equal(
      mod.QUEBEC_LOBBYING.BASE,
      'https://www.lobbyists.quebec/',
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Province Configs                                                    */
/* ------------------------------------------------------------------ */

describe('PROVINCE_CONFIGS', () => {
  it('has exactly 13 entries', async () => {
    const { PROVINCE_CONFIGS } = await import('../types.js');
    assert.equal(PROVINCE_CONFIGS.length, 13);
  });

  it('includes SK config with correct values', async () => {
    const { PROVINCE_CONFIGS } = await import('../types.js');
    const sk = PROVINCE_CONFIGS.find(c => c.code === 'SK');
    assert.ok(sk, 'SK config exists');
    assert.equal(sk!.name, 'Saskatchewan');
    assert.equal(sk!.registryUrl, 'https://www.sasklobbyistregistry.ca/');
    assert.equal(sk!.hasMonthlyCsv, false);
  });

  it('includes MB config with correct values', async () => {
    const { PROVINCE_CONFIGS } = await import('../types.js');
    const mb = PROVINCE_CONFIGS.find(c => c.code === 'MB');
    assert.ok(mb, 'MB config exists');
    assert.equal(mb!.name, 'Manitoba');
    assert.equal(mb!.registryUrl, 'https://www.lobbyistregistrar.mb.ca/');
    assert.equal(mb!.hasMonthlyCsv, false);
  });

  it('includes NS config with correct values', async () => {
    const { PROVINCE_CONFIGS } = await import('../types.js');
    const ns = PROVINCE_CONFIGS.find(c => c.code === 'NS');
    assert.ok(ns, 'NS config exists');
    assert.equal(ns!.name, 'Nova Scotia');
    assert.equal(ns!.registryUrl, 'https://novascotia.ca/sns/Lobbyist/');
    assert.equal(ns!.hasMonthlyCsv, false);
  });

  it('includes NB config with correct values', async () => {
    const { PROVINCE_CONFIGS } = await import('../types.js');
    const nb = PROVINCE_CONFIGS.find(c => c.code === 'NB');
    assert.ok(nb, 'NB config exists');
    assert.equal(nb!.name, 'New Brunswick');
    assert.equal(nb!.registryUrl, 'https://www.oic-bci.ca/');
    assert.equal(nb!.hasMonthlyCsv, false);
  });

  it('includes NL config with correct values', async () => {
    const { PROVINCE_CONFIGS } = await import('../types.js');
    const nl = PROVINCE_CONFIGS.find(c => c.code === 'NL');
    assert.ok(nl, 'NL config exists');
    assert.equal(nl!.name, 'Newfoundland and Labrador');
    assert.equal(nl!.registryUrl, 'https://www.gov.nl.ca/gs/registries/lobbyists/');
    assert.equal(nl!.hasMonthlyCsv, false);
  });

  it('includes PE config with correct values', async () => {
    const { PROVINCE_CONFIGS } = await import('../types.js');
    const pe = PROVINCE_CONFIGS.find(c => c.code === 'PE');
    assert.ok(pe, 'PE config exists');
    assert.equal(pe!.name, 'Prince Edward Island');
    assert.equal(pe!.registryUrl, 'https://www.princeedwardisland.ca/en/feature/lobbyist-registry');
    assert.equal(pe!.hasMonthlyCsv, false);
  });

  it('includes YT config with correct values', async () => {
    const { PROVINCE_CONFIGS } = await import('../types.js');
    const yt = PROVINCE_CONFIGS.find(c => c.code === 'YT');
    assert.ok(yt, 'YT config exists');
    assert.equal(yt!.name, 'Yukon');
    assert.equal(yt!.registryUrl, 'https://yukonlobbyistregistry.ca/');
    assert.equal(yt!.hasMonthlyCsv, false);
  });

  it('includes NT config with N/A commissioner', async () => {
    const { PROVINCE_CONFIGS } = await import('../types.js');
    const nt = PROVINCE_CONFIGS.find(c => c.code === 'NT');
    assert.ok(nt, 'NT config exists');
    assert.equal(nt!.name, 'Northwest Territories');
    assert.ok(nt!.commissioner.includes('N/A'));
    assert.equal(nt!.hasMonthlyCsv, false);
  });

  it('includes NU config with N/A commissioner', async () => {
    const { PROVINCE_CONFIGS } = await import('../types.js');
    const nu = PROVINCE_CONFIGS.find(c => c.code === 'NU');
    assert.ok(nu, 'NU config exists');
    assert.equal(nu!.name, 'Nunavut');
    assert.ok(nu!.commissioner.includes('N/A'));
    assert.equal(nu!.hasMonthlyCsv, false);
  });
});

/* ------------------------------------------------------------------ */
/*  Parser — Active province normalizers                                */
/* ------------------------------------------------------------------ */

describe('normalizeSaskatchewanRecord', () => {
  it('returns normalized record with correct province field', async () => {
    const { normalizeSaskatchewanRecord } = await import('../parser.js');
    const result = await normalizeSaskatchewanRecord({
      lobbyistName: 'SK Lobbyist Inc.',
      clientName: 'SK Client Corp.',
      subjectMatters: ['Health'],
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'SK');
    assert.equal(result!.sourceSystem, 'saskatchewan-registry');
    assert.deepEqual(result!.subjectMatter, ['Health']);
  });

  it('returns null when both registrantName and clientName are empty', async () => {
    const { normalizeSaskatchewanRecord } = await import('../parser.js');
    const result = await normalizeSaskatchewanRecord({});
    assert.equal(result, null);
  });
});

describe('normalizeManitobaRecord', () => {
  it('returns normalized record with correct province field', async () => {
    const { normalizeManitobaRecord } = await import('../parser.js');
    const result = await normalizeManitobaRecord({
      lobbyistName: 'MB Lobbyist Inc.',
      clientName: 'MB Client Corp.',
      subjectMatters: ['Energy'],
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'MB');
    assert.equal(result!.sourceSystem, 'manitoba-registry');
    assert.deepEqual(result!.subjectMatter, ['Energy']);
  });

  it('returns null when both registrantName and clientName are empty', async () => {
    const { normalizeManitobaRecord } = await import('../parser.js');
    const result = await normalizeManitobaRecord({});
    assert.equal(result, null);
  });
});

describe('normalizeNovaScotiaRecord', () => {
  it('returns normalized record with correct province field', async () => {
    const { normalizeNovaScotiaRecord } = await import('../parser.js');
    const result = await normalizeNovaScotiaRecord({
      lobbyistName: 'NS Lobbyist Inc.',
      clientName: 'NS Client Corp.',
      subjectMatters: ['Environment'],
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'NS');
    assert.equal(result!.sourceSystem, 'nova-scotia-registry');
    assert.deepEqual(result!.subjectMatter, ['Environment']);
  });

  it('returns null when both registrantName and clientName are empty', async () => {
    const { normalizeNovaScotiaRecord } = await import('../parser.js');
    const result = await normalizeNovaScotiaRecord({});
    assert.equal(result, null);
  });
});

describe('normalizeNewBrunswickRecord', () => {
  it('returns normalized record with correct province field', async () => {
    const { normalizeNewBrunswickRecord } = await import('../parser.js');
    const result = await normalizeNewBrunswickRecord({
      lobbyistName: 'NB Lobbyist Inc.',
      clientName: 'NB Client Corp.',
      subjectMatters: ['Education'],
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'NB');
    assert.equal(result!.sourceSystem, 'new-brunswick-registry');
    assert.deepEqual(result!.subjectMatter, ['Education']);
  });

  it('returns null when both registrantName and clientName are empty', async () => {
    const { normalizeNewBrunswickRecord } = await import('../parser.js');
    const result = await normalizeNewBrunswickRecord({});
    assert.equal(result, null);
  });
});

describe('normalizeNewfoundlandRecord', () => {
  it('returns normalized record with correct province field', async () => {
    const { normalizeNewfoundlandRecord } = await import('../parser.js');
    const result = await normalizeNewfoundlandRecord({
      lobbyistName: 'NL Lobbyist Inc.',
      clientName: 'NL Client Corp.',
      subjectMatters: ['Finance'],
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'NL');
    assert.equal(result!.sourceSystem, 'newfoundland-registry');
    assert.deepEqual(result!.subjectMatter, ['Finance']);
  });

  it('returns null when both registrantName and clientName are empty', async () => {
    const { normalizeNewfoundlandRecord } = await import('../parser.js');
    const result = await normalizeNewfoundlandRecord({});
    assert.equal(result, null);
  });
});

describe('normalizePEIRecord', () => {
  it('returns normalized record with correct province field', async () => {
    const { normalizePEIRecord } = await import('../parser.js');
    const result = await normalizePEIRecord({
      lobbyistName: 'PE Lobbyist Inc.',
      clientName: 'PE Client Corp.',
      subjectMatters: ['Tourism'],
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'PE');
    assert.equal(result!.sourceSystem, 'pei-registry');
    assert.deepEqual(result!.subjectMatter, ['Tourism']);
  });

  it('returns null when both registrantName and clientName are empty', async () => {
    const { normalizePEIRecord } = await import('../parser.js');
    const result = await normalizePEIRecord({});
    assert.equal(result, null);
  });
});

describe('normalizeYukonRecord', () => {
  it('returns normalized record with correct province field', async () => {
    const { normalizeYukonRecord } = await import('../parser.js');
    const result = await normalizeYukonRecord({
      lobbyistName: 'YT Lobbyist Inc.',
      clientName: 'YT Client Corp.',
      subjectMatters: ['Infrastructure'],
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'YT');
    assert.equal(result!.sourceSystem, 'yukon-registry');
    assert.deepEqual(result!.subjectMatter, ['Infrastructure']);
  });

  it('returns null when both registrantName and clientName are empty', async () => {
    const { normalizeYukonRecord } = await import('../parser.js');
    const result = await normalizeYukonRecord({});
    assert.equal(result, null);
  });
});

/* ------------------------------------------------------------------ */
/*  Parser — Territory stubs (always return null)                       */
/* ------------------------------------------------------------------ */

describe('normalizeNWTRecord', () => {
  it('returns null without communicationDate', async () => {
    const { normalizeNWTRecord } = await import('../parser.js');
    const result = await normalizeNWTRecord({ lobbyistName: 'Anyone' });
    assert.equal(result, null);
  });

  it('returns record with communicationDate', async () => {
    const { normalizeNWTRecord } = await import('../parser.js');
    const result = await normalizeNWTRecord({
      lobbyistName: 'Minister Name',
      clientName: 'Outside Party Corp',
      communicationDate: '2025-03-12',
      subjectMatters: ['Interest Group and Association'],
      governmentBodies: ['Minister of Industry'],
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'NT');
    assert.equal(result!.sourceSystem, 'nwt-meeting-registry');
    assert.equal(result!.communicationDate, '2025-03-12');
  });
});

describe('normalizeNunavutRecord', () => {
  it('returns null for empty input', async () => {
    const { normalizeNunavutRecord } = await import('../parser.js');
    const result = await normalizeNunavutRecord({});
    assert.equal(result, null);
  });

  it('returns federal proxy record with correct province', async () => {
    const { normalizeNunavutRecord } = await import('../parser.js');
    const result = await normalizeNunavutRecord({
      lobbyistName: 'Jen Hayward',
      clientName: 'Nunavut Tunngavik Incorporated',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'NU');
    assert.equal(result!.sourceSystem, 'nunavut-federal-proxy');
  });
});

/* ------------------------------------------------------------------ */
/*  Parser — Existing province normalizers still exported               */
/* ------------------------------------------------------------------ */

describe('established province normalizers', () => {
  it('normalizeOntarioRecord works', async () => {
    const { normalizeOntarioRecord } = await import('../parser.js');
    const result = await normalizeOntarioRecord({
      lobbyistName: 'ON Lobbyist',
      clientName: 'ON Client',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'ON');
    assert.equal(result!.sourceSystem, 'ontario-registry');
  });

  it('normalizeBCRecord works', async () => {
    const { normalizeBCRecord } = await import('../parser.js');
    const result = await normalizeBCRecord({
      lobbyistName: 'BC Lobbyist',
      clientName: 'BC Client',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'BC');
    assert.equal(result!.sourceSystem, 'bc-registry');
  });

  it('normalizeAlbertaRecord works', async () => {
    const { normalizeAlbertaRecord } = await import('../parser.js');
    const result = await normalizeAlbertaRecord({
      lobbyistName: 'AB Lobbyist',
      clientName: 'AB Client',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'AB');
    assert.equal(result!.sourceSystem, 'alberta-registry');
  });

  it('normalizeQuebecRecord works', async () => {
    const { normalizeQuebecRecord } = await import('../parser.js');
    const result = await normalizeQuebecRecord({
      lobbyistName: 'QC Lobbyist',
      clientName: 'QC Client',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'QC');
    assert.equal(result!.sourceSystem, 'quebec-registry');
  });
});

/* ------------------------------------------------------------------ */
/*  normalizeToFederalSchema dispatch                                    */
/* ------------------------------------------------------------------ */

describe('normalizeToFederalSchema', () => {
  it('dispatches SK correctly', async () => {
    const { normalizeToFederalSchema } = await import('../parser.js');
    const result = await normalizeToFederalSchema('SK', {
      lobbyistName: 'Test',
      clientName: 'Test',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'SK');
  });

  it('dispatches MB correctly', async () => {
    const { normalizeToFederalSchema } = await import('../parser.js');
    const result = await normalizeToFederalSchema('MB', {
      lobbyistName: 'Test',
      clientName: 'Test',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'MB');
  });

  it('dispatches NS correctly', async () => {
    const { normalizeToFederalSchema } = await import('../parser.js');
    const result = await normalizeToFederalSchema('NS', {
      lobbyistName: 'Test',
      clientName: 'Test',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'NS');
  });

  it('dispatches NB correctly', async () => {
    const { normalizeToFederalSchema } = await import('../parser.js');
    const result = await normalizeToFederalSchema('NB', {
      lobbyistName: 'Test',
      clientName: 'Test',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'NB');
  });

  it('dispatches NL correctly', async () => {
    const { normalizeToFederalSchema } = await import('../parser.js');
    const result = await normalizeToFederalSchema('NL', {
      lobbyistName: 'Test',
      clientName: 'Test',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'NL');
  });

  it('dispatches PE correctly', async () => {
    const { normalizeToFederalSchema } = await import('../parser.js');
    const result = await normalizeToFederalSchema('PE', {
      lobbyistName: 'Test',
      clientName: 'Test',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'PE');
  });

  it('dispatches YT correctly', async () => {
    const { normalizeToFederalSchema } = await import('../parser.js');
    const result = await normalizeToFederalSchema('YT', {
      lobbyistName: 'Test',
      clientName: 'Test',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'YT');
  });

  it('dispatches NT (returns null)', async () => {
    const { normalizeToFederalSchema } = await import('../parser.js');
    const result = await normalizeToFederalSchema('NT', {
      lobbyistName: 'Test',
      clientName: 'Test',
    });
    assert.equal(result, null);
  });

  it('dispatches NU (returns federal proxy record)', async () => {
    const { normalizeToFederalSchema } = await import('../parser.js');
    const result = await normalizeToFederalSchema('NU', {
      lobbyistName: 'Test',
      clientName: 'Test',
    });
    assert.ok(result !== null);
    assert.equal(result!.province, 'NU');
  });
});

/* ------------------------------------------------------------------ */
/*  Fetcher exports                                                     */
/* ------------------------------------------------------------------ */

describe('fetcher exports', () => {
  it('fetchOntarioLobbying is a function', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.fetchOntarioLobbying, 'function');
  });

  it('fetchBCLobbying is a function', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.fetchBCLobbying, 'function');
  });

  it('fetchAlbertaLobbying is a function', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.fetchAlbertaLobbying, 'function');
  });

  it('fetchQuebecLobbying is a function', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.fetchQuebecLobbying, 'function');
  });

  it('ingestOntarioLobbying is a function', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.ingestOntarioLobbying, 'function');
  });

  it('ingestOntarioLobbying accepts db and options', async () => {
    const mod = await import('../index.js');
    assert.ok(mod.ingestOntarioLobbying.length >= 1);
  });

  it('searchProvincialLobbying is a function', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.searchProvincialLobbying, 'function');
  });

  it('ingestAllProvincial is a function', async () => {
    const mod = await import('../index.js');
    assert.equal(typeof mod.ingestAllProvincial, 'function');
  });
});
