import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { applyPrivateNamesSqlite, applyPrivateNamesMemory } from '../src/private-names-migration.ts';

test('sqlite migration drops donor names and redacts insider filings', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      names TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      raw_data TEXT NOT NULL
    );
    INSERT INTO persons (id, names, first_name, last_name, email, raw_data)
    VALUES ('person-1', '["Example Donor"]', 'Example', 'Donor', 'donor@example.test', '{"name":"Example Donor"}');

    CREATE TABLE donations (
      id TEXT PRIMARY KEY,
      donor_name TEXT NOT NULL,
      donor_person_id TEXT,
      recipient_name TEXT NOT NULL,
      recipient_type TEXT NOT NULL,
      amount REAL NOT NULL,
      riding TEXT,
      province TEXT,
      source TEXT NOT NULL
    );
    INSERT INTO donations (id, donor_name, donor_person_id, recipient_name, recipient_type, amount, riding, province, source)
    VALUES
      ('d1', 'Example Donor', 'person-1', 'Example Party', 'party', 250, 'Example Riding', 'ON', 'elections'),
      ('d2', 'Other Donor', NULL, 'Example Party', 'party', 2500, 'Example Riding', 'ON', 'elections');

    CREATE TABLE sedar_filings (
      filing_id TEXT PRIMARY KEY,
      filing_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      issuer_name TEXT NOT NULL
    );
    INSERT INTO sedar_filings (filing_id, filing_type, title, description, issuer_name)
    VALUES
      ('f1', 'insider-report', 'Example Insider — insider report', 'Bought shares', 'Example Issuer'),
      ('f2', 'early-warning-report', 'Example Holder crosses 10 percent', 'Early warning', 'Example Issuer'),
      ('f3', 'proxy-circular', 'Management proxy circular', 'Directors and officers', 'Example Issuer');
  `);

  applyPrivateNamesSqlite(db);
  applyPrivateNamesSqlite(db);

  const cols = db.prepare('PRAGMA table_info(donations)').all() as { name: string }[];
  const names = cols.map((c) => c.name);
  assert.equal(names.includes('donor_name'), false);
  assert.equal(names.includes('party'), true);
  const donations = db.prepare('SELECT party, riding, amount_band, contribution_count, total_amount FROM donations ORDER BY amount_band').all() as {
    party: string;
    amount_band: string;
    contribution_count: number;
    total_amount: number;
  }[];
  const text = JSON.stringify(donations);
  assert.equal(text.includes('Donor'), false);
  assert.equal(donations.some((row) => row.party === 'Example Party' && row.amount_band === '200-999'), true);
  assert.equal(donations.some((row) => row.amount_band === '2000+'), true);

  const person = db.prepare('SELECT names, first_name, email FROM persons WHERE id = ?').get('person-1') as {
    names: string;
    first_name: string | null;
    email: string | null;
  };
  assert.equal(person.names, '[]');
  assert.equal(person.first_name, null);
  assert.equal(person.email, null);

  const insider = db.prepare("SELECT title, description, issuer_name FROM sedar_filings WHERE filing_type = 'insider-report'").get() as {
    title: string;
    description: string | null;
    issuer_name: string;
  };
  assert.equal(insider.title, 'Insider report');
  assert.equal(insider.description, null);
  assert.equal(insider.issuer_name, 'Example Issuer');
  const proxy = db.prepare("SELECT title, description FROM sedar_filings WHERE filing_type = 'proxy-circular'").get() as {
    title: string;
    description: string;
  };
  assert.equal(proxy.title, 'Management proxy circular');
  assert.equal(proxy.description, 'Directors and officers');
  db.close();
});

test('memory backend migration is a no-op', () => {
  applyPrivateNamesMemory();
});
