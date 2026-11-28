import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectCkanRecord,
  budgetedProjection,
  CKAN_RESULT_BYTE_BUDGET,
} from '../tools/ckan-projection.js';

/** A record shaped like the one that stalled the agent: 60 KB, mostly `resources`. */
function rawRecord(index: number, resourceCount = 40): Record<string, unknown> {
  return {
    id: `ds-${index}`,
    name: `perm-residents-${index}`,
    title: `Permanent Residents — ${index}`,
    notes: 'Monthly admissions by province, category and country of citizenship. '.repeat(6),
    url: `https://open.canada.ca/data/en/dataset/ds-${index}`,
    org_title_at_publication: 'Immigration, Refugees and Citizenship Canada',
    organization: { name: 'ircc', title: 'IRCC', description: 'x'.repeat(4000) },
    metadata_created: '2024-01-01T00:00:00',
    metadata_modified: '2024-06-01T00:00:00',
    date_published: '2024-02-01',
    tags: [{ name: 'immigration', display_name: 'Immigration' }, { name: 'pr' }],
    subject: ['immigration'],
    relationships_as_object: [{ subject: 'a', object: 'b', comment: 'y'.repeat(2000) }],
    notes_translated: { en: 'English notes', fr: 'Notes en francais' },
    resources: Array.from({ length: resourceCount }, (_, i) => ({
      format: i % 2 === 0 ? 'CSV' : 'JSON',
      url: `https://example.invalid/file-${i}.csv`,
      size: 1_000_000,
      hash: 'z'.repeat(64),
      datastore_active: true,
    })),
  };
}

test('projection keeps the fields an agent uses and drops the registry blob', () => {
  const raw = rawRecord(1);
  const projected = projectCkanRecord(raw);

  const rawBytes = JSON.stringify(raw).length;
  const projectedBytes = JSON.stringify(projected).length;

  assert.ok(rawBytes > 10_000, `fixture should be blob-sized, got ${rawBytes}`);
  assert.ok(projectedBytes < 1_500, `projection should be small, got ${projectedBytes}`);
  assert.ok(
    rawBytes / projectedBytes > 10,
    `projection must shrink by an order of magnitude, got ${Math.round(rawBytes / projectedBytes)}x`,
  );

  assert.equal(projected.id, 'ds-1');
  assert.equal(projected.title, 'Permanent Residents — 1');
  assert.equal(projected.publisher, 'Immigration, Refugees and Citizenship Canada');
  assert.equal(projected.published, '2024-02-01');
  assert.equal(projected.modified, '2024-06-01T00:00:00');
  assert.equal(projected.resource_count, 40);
  assert.deepEqual(projected.formats, ['CSV', 'JSON']);
  assert.deepEqual(projected.subjects, ['Immigration', 'pr']);
  assert.ok(String(projected.notes).length <= 320);
});

test('notes are flattened and truncated with an ellipsis', () => {
  const projected = projectCkanRecord({
    title: 't',
    notes: `${'line one\n'.repeat(80)}end`,
  });
  const notes = String(projected.notes);
  assert.ok(!notes.includes('\n'), 'notes must be single-line');
  assert.ok(notes.length <= 320);
  assert.ok(notes.endsWith('…'));
});

test('translated titles and notes fall back to a usable string', () => {
  const projected = projectCkanRecord({
    title_translated: { en: 'Translated title', fr: 'Titre traduit' },
    notes_translated: { en: 'Translated notes', fr: 'Notes traduites' },
  });
  assert.equal(projected.title, 'Translated title');
  assert.equal(projected.notes, 'Translated notes');
});

test('the byte budget truncates instead of returning a megabyte', () => {
  const raw = Array.from({ length: 200 }, (_, i) => rawRecord(i));
  const { results, truncated } = budgetedProjection(raw);

  const bytes = JSON.stringify(results).length;
  assert.ok(bytes <= CKAN_RESULT_BYTE_BUDGET, `budget exceeded: ${bytes}`);
  assert.equal(truncated, true);
  assert.ok(results.length > 0 && results.length < raw.length);
});

test('a single oversized record is returned rather than an empty list', () => {
  const huge = { title: 'x', notes: 'y'.repeat(40_000) };
  const { results } = budgetedProjection([huge]);
  assert.equal(results.length, 1);
});
