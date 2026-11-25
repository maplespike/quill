import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SHORT_EXCERPT_MAX } from '../../../shared/source-policy.js';
import { capStatementText, extractExecutiveStatements } from '../statements.js';
import { upsertExecutiveStatement } from '../db.js';
import type { ExecutiveStatement } from '../types.js';
import type { D1Database } from '../../committees/db.js';

describe('executive statement excerpts', () => {
  it('caps stored text at the source-policy excerpt limit', () => {
    const body = `<p>Andrew MacLeod announced results. ${'<b>revenue</b> '.repeat(80)}</p>`;
    const statements = extractExecutiveStatements([{
      id: 'stmt-1',
      title: 'Postmedia results',
      body,
      date: '2026-01-15',
      organization: 'Postmedia Network',
      url: 'https://example.com/postmedia',
      source: 'company-ir',
    }]);

    assert.equal(statements.length, 1);
    const statement = statements[0];
    assert.ok(statement.text.length <= SHORT_EXCERPT_MAX);
    assert.equal(statement.text.length, SHORT_EXCERPT_MAX);
    assert.equal(statement.excerpt, statement.text);
    assert.equal(statement.text.includes('<'), false);
    assert.equal(statement.text.endsWith('…'), true);
    assert.equal(statement.executiveName, 'Andrew MacLeod');
  });

  it('keeps a short plain description whole', () => {
    const body = 'Andrew MacLeod said the quarter was steady.';
    const [statement] = extractExecutiveStatements([{
      id: 'stmt-2',
      title: 'Short note',
      body,
      date: '2026-02-01',
      organization: 'Postmedia Network',
      url: 'https://example.com/short',
      source: 'company-ir',
    }]);
    assert.equal(statement.text, body);
    assert.ok(statement.text.length < SHORT_EXCERPT_MAX);
  });

  it('caps text again at insert time', async () => {
    const bound: unknown[][] = [];
    const db = {
      prepare() {
        return {
          bind(...args: unknown[]) {
            bound.push(args);
            return this;
          },
          async run() {
            return { success: true };
          },
        };
      },
    } as unknown as D1Database;

    const statement: ExecutiveStatement = {
      id: 'stmt-3',
      executiveName: 'Andrew MacLeod',
      executiveTitle: 'CEO',
      organization: 'Postmedia Network',
      organizationTicker: 'PNC.B',
      statementType: 'press-release',
      date: '2026-03-01',
      title: 'Long filing',
      text: `<div>${'x'.repeat(900)}</div>`,
      excerpt: 'y'.repeat(500),
      sourceUrl: 'https://example.com/long',
      topics: [],
      isCommitteeAppearance: false,
      committeeMeetingId: null,
      ingestedAt: '2026-03-01T00:00:00.000Z',
    };

    assert.equal(await upsertExecutiveStatement(db, statement), true);
    const text = bound[0][8];
    const excerpt = bound[0][9];
    assert.equal(typeof text, 'string');
    assert.equal(typeof excerpt, 'string');
    assert.ok((text as string).length <= SHORT_EXCERPT_MAX);
    assert.ok((excerpt as string).length <= SHORT_EXCERPT_MAX);
    assert.equal((text as string).includes('<'), false);
    assert.equal(capStatementText(statement.text), text);
  });
});
