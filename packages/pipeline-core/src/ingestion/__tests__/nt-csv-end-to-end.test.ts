import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchNTCsv, parseNTCsv } from '../provincial-lobbying/fetchers/nt.js';

const shouldRun = process.env.LIVE_DATA_TEST === 'true' || process.env.CI === 'true';

describe('NT CSV Meeting Registry end-to-end', { skip: !shouldRun }, () => {
  if (!shouldRun) return;

  let csvText: string;

  it('fetchNTCsv downloads CSV from GNWT endpoint', async () => {
    csvText = await fetchNTCsv();
    assert.ok(csvText.length > 0, 'CSV response should not be empty');
    assert.ok(csvText.includes('meeting'), 'CSV should contain meeting column header');
    assert.ok(csvText.includes('date'), 'CSV should contain date column header');
    assert.ok(csvText.includes('minister'), 'CSV should contain minister column header');
  });

  it('parseNTCsv returns RawNWTRecord array with expected structure', () => {
    const records = parseNTCsv(csvText);
    assert.ok(Array.isArray(records), 'parseNTCsv should return an array');
    assert.ok(records.length > 0, 'should parse at least one record from the CSV');

    for (const record of records) {
      assert.ok(typeof record.registrationNumber === 'string', 'registrationNumber should be a string');
      assert.ok(record.registrationNumber!.length > 0, 'registrationNumber should not be empty');
      assert.ok(typeof record.communicationDate === 'string', 'communicationDate should be a string');
      assert.ok(record.communicationDate!.length > 0, 'communicationDate should not be empty');
      assert.ok(typeof record.sourceUrl === 'string', 'sourceUrl should be a string');
      assert.ok(
        record.sourceUrl!.includes('engage.eia.gov.nt.ca'),
        'sourceUrl should point to GNWT portal',
      );

      if (record.lobbyistName) {
        assert.ok(typeof record.lobbyistName === 'string', 'lobbyistName should be a string');
      }
      if (record.clientName) {
        assert.ok(typeof record.clientName === 'string', 'clientName should be a string');
      }
      if (record.governmentBodies) {
        assert.ok(Array.isArray(record.governmentBodies), 'governmentBodies should be an array');
      }
      if (record.subjectMatters) {
        assert.ok(Array.isArray(record.subjectMatters), 'subjectMatters should be an array');
      }
      if (record.officials) {
        assert.ok(Array.isArray(record.officials), 'officials should be an array');
        for (const official of record.officials) {
          assert.ok(typeof official === 'string', 'each official should be a string');
        }
      }
    }
  });

  it('records have valid date format', () => {
    const records = parseNTCsv(csvText);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const record of records) {
      if (record.communicationDate) {
        assert.ok(
          dateRegex.test(record.communicationDate),
          `communicationDate "${record.communicationDate}" should be YYYY-MM-DD`,
        );
      }
    }
  });
});
