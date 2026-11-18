/**
 * Owner decision 2026-11-09: House of Commons and Senate committee, debate,
 * Hansard, and vote tools and routes stay on the free tier.
 *
 * Fails when a parliamentary tool gains a price or a quota meter, when an
 * export route for those families leaves the free tier or starts counting
 * toward a paid-plan quota, or when a parliamentary response drops the
 * reuse line or serves an excerpt longer than 300 characters.
 *
 *   pnpm exec tsx --test scripts/test-parliamentary-free.mts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PARLIAMENTARY_EXCERPT_MAX,
  PARLIAMENTARY_REUSE_LINE,
  PARLIAMENTARY_TOOL_NAMES,
  isParliamentaryTool,
  presentParliamentary,
  truncateParliamentaryExcerpt,
} from '../packages/pipeline-core/src/shared/parliamentary-public.ts';
import { getAllPrices, getToolPrice } from '../packages/quill-mcp/src/pricing.ts';
import { countsTowardPaidQuota, isFreeTierRoute } from '../packages/api-server/src/feature-gates.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('parliamentary tools and routes have no plan gate', () => {
  it('prices every parliamentary tool at zero and does not meter it', () => {
    const prices = getAllPrices();
    for (const name of PARLIAMENTARY_TOOL_NAMES) {
      const price = getToolPrice(name);
      assert.equal(price.tier, 'free', name);
      assert.equal(price.priceUsd, 0, name);
      const listed = prices[name.replace(/_/g, '-')];
      assert.ok(listed, `${name} must stay in the price map`);
      assert.equal(listed.tier, 'free', name);
      assert.equal(listed.priceUsd, 0, name);
    }
    assert.equal(getToolPrice('search_gazette').priceUsd > 0, true);
  });

  it('keeps the quota skip wired in the MCP server and the API gateway', () => {
    const server = read('packages/quill-mcp/src/server.ts');
    assert.match(server, /parliamentaryToolMetersQuota\(toolName\)/);
    assert.match(server, /recordCall\(identity\)/);
    const pricing = read('packages/quill-mcp/src/pricing.ts');
    assert.match(pricing, /isParliamentaryTool\(toolName\)/);
    const gates = read('packages/api-server/src/feature-gates.ts');
    assert.match(gates, /isParliamentaryApiPath\(path\)/);
    const index = read('packages/api-server/src/index.ts');
    assert.match(index, /countsTowardPaidQuota\(path\)/);
    assert.match(index, /meterQuota/);
  });

  it('allows parliamentary export routes on the free tier and does not count them', () => {
    const freePaths = [
      '/v1/export/committees',
      '/v1/export/committees/meeting-1',
      '/v1/export/parliamentary-voting',
      '/v1/export/parliamentary-voting/div-1',
    ];
    for (const path of freePaths) {
      assert.equal(isFreeTierRoute(path), true, path);
      assert.equal(countsTowardPaidQuota(path), false, path);
    }
    for (const path of ['/v1/export/sedi', '/v1/export/gazette', '/v1/gov/search', '/v1/ai/ask']) {
      assert.equal(isFreeTierRoute(path), false, path);
      assert.equal(countsTowardPaidQuota(path), true, path);
    }
  });

  it('requires the shared helper on every parliamentary tool file', () => {
    const toolDir = resolve(ROOT, 'packages/quill-mcp/src/tools');
    const seen = new Set<string>();
    for (const file of readdirSync(toolDir)) {
      if (!file.endsWith('.ts')) continue;
      const text = readFileSync(resolve(toolDir, file), 'utf8');
      // Prompt catalogs and indexes mention tool names. Only handler modules
      // (a ToolDefinition or ToolHandler) have to call the helper.
      if (!text.includes('ToolDefinition') && !text.includes('ToolHandler')) continue;
      const names = [...text.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1]);
      for (const name of names) {
        if (!isParliamentaryTool(name)) continue;
        seen.add(name);
        assert.match(
          text,
          /presentParliamentaryToolResult\(/,
          `${file} serves ${name} and must call presentParliamentaryToolResult`,
        );
      }
    }
    for (const name of PARLIAMENTARY_TOOL_NAMES) {
      assert.equal(seen.has(name), true, `${name} must be declared on a tool that calls the helper`);
    }
    const exportRoute = read('packages/api-server/src/routes/export.ts');
    assert.match(exportRoute, /presentParliamentary\(/);
    assert.match(exportRoute, /applySourcePolicy\(/);
  });
});

describe('parliamentary attribution and excerpt length', () => {
  it('carries the reuse line, the house link, and an excerpt of at most 300 characters', () => {
    const prose = 'The committee heard evidence on the fiscal framework and the vote that followed. ';
    const response = presentParliamentary(
      {
        summary: prose.repeat(12),
        results: [
          {
            title: 'Meeting',
            description: 'z'.repeat(800),
            url: 'https://www.ourcommons.ca/DocumentViewer/en/44-1/FINA/meeting-2/evidence',
          },
        ],
      },
      { chamber: 'commons' },
    );
    const attribution = String(response.attribution);
    assert.match(attribution, /ourcommons\.ca/);
    assert.equal(attribution.includes(PARLIAMENTARY_REUSE_LINE), true);
    assert.match(attribution, /not an official version/);
    assert.match(attribution, /does not imply endorsement/);
    assert.ok(String(response.summary).length <= PARLIAMENTARY_EXCERPT_MAX);
    const row = (response.results as { description: string; attribution: string }[])[0];
    assert.equal(row.description.length <= PARLIAMENTARY_EXCERPT_MAX, true);
    assert.equal(row.description.length, PARLIAMENTARY_EXCERPT_MAX);
    assert.match(row.attribution, /ourcommons\.ca/);
    assert.equal(row.attribution.includes(PARLIAMENTARY_REUSE_LINE), true);

    const senate = presentParliamentary({ notes: prose.repeat(8) }, { chamber: 'senate' });
    assert.match(String(senate.attribution), /sencanada\.ca/);
    assert.equal(String(senate.attribution).includes(PARLIAMENTARY_REUSE_LINE), true);
    assert.ok(String(senate.notes).length <= 300);
    assert.equal(truncateParliamentaryExcerpt('n'.repeat(301)).length <= 300, true);
  });
});
