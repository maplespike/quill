#!/usr/bin/env node
import { readFileSync } from 'fs';

/**
 * Open Data Portal Coverage Analysis
 * Compares jpmckinney/open_data_canada catalog against MapleSpike module registry
 * Generates gap report by jurisdiction and prioritizes module additions
 */

interface Portal {
  name: string;
  jurisdiction: string;
  type: string;
  population: number;
  url: string;
}

interface Module {
  name: string;
  sources: { name: string; format: string }[];
}

// CSV data from jpmckinney/open_data_canada
const PORTAL_CSV = readFileSync('/tmp/portals-full.csv', 'utf-8');

// Module registry sources (from registry.ts)
const MODULE_SOURCES = [
  'open.canada.ca',
  'data.ontario.ca',
  'catalogue.data.gov.bc.ca',
  'open.alberta.ca',
  'donneesquebec.ca',
  'data.saskatchewan.ca',
  'data.gov.mb.ca',
  'data.novascotia.ca',
  'data.gnb.ca',
  'data.gov.nl.ca',
  'data.princeedwardisland.ca',
  'www.gov.nt.ca/data',
  'data.gov.nu.ca',
  'data.yukon.ca',
  'www.cbc.ca',
  'www150.statcan.gc.ca',
  'www.ourcommons.ca',
  'www.infobasegc.ca',
  'gazette.gc.ca',
  'oag-bvg.gc.ca',
  'pbo-dpb.ca',
  'ciec-ccie.parl.gc.ca',
  'www.elections.ca',
  'api.canlii.org',
  'open.canada.ca',
  'budget.canada.ca',
  'www.canada.ca',
  'health-products.canada.ca',
  'lobbycanada.gc.ca',
  'www.sedi.ca',
  'apps.cra-arc.gc.ca',
  'www.bankofcanada.ca',
  'crtc.gc.ca',
  'sac-isc.gc.ca',
  'ircc.canada.ca',
];

function parseCSV(csv: string): Portal[] {
  const lines = csv.split('\n').slice(1);
  const portals: Portal[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim());

    if (parts.length >= 5) {
      const population = parseInt(parts[3].replace(/,/g, '')) || 0;
      portals.push({
        name: parts[0],
        jurisdiction: parts[1] || 'National',
        type: parts[2] || '',
        population,
        url: parts[4],
      });
    }
  }

  return portals;
}

function isCovered(url: string, moduleSources: string[]): boolean {
  for (const source of moduleSources) {
    if (url.includes(source)) {
      return true;
    }
  }
  return false;
}

function analyzeCoverage(portals: Portal[], moduleSources: string[]) {
  const federal: Portal[] = [];
  const provincial: Portal[] = [];
  const municipal: Portal[] = [];

  const covered: Portal[] = [];
  const uncovered: Portal[] = [];

  for (const portal of portals) {
    if (portal.name === 'Canada') {
      federal.push(portal);
    } else if (
      ['Newfoundland and Labrador', 'Prince Edward Island', 'Nova Scotia', 'New Brunswick',
       'Quebec', 'Ontario', 'Alberta', 'British Columbia', 'Manitoba', 'Saskatchewan',
       'Northwest Territories', 'Nunavut', 'Yukon'].includes(portal.name)
    ) {
      provincial.push(portal);
    } else {
      municipal.push(portal);
    }

    if (isCovered(portal.url, moduleSources)) {
      covered.push(portal);
    } else {
      uncovered.push(portal);
    }
  }

  return { federal, provincial, municipal, covered, uncovered };
}

function generateMarkdownReport(analysis: ReturnType<typeof analyzeCoverage>) {
  const totalPortals = analysis.federal.length + analysis.provincial.length + analysis.municipal.length;
  const totalCovered = analysis.covered.length;
  const totalUncovered = analysis.uncovered.length;
  const coveragePercentage = ((totalCovered / totalPortals) * 100).toFixed(1);

  let report = `# Canadian Open Data Portal Coverage Analysis

Generated: ${new Date().toISOString()}

## Summary

| Metric | Count |
|--------|-------|
| Total portals cataloged | ${totalPortals} |
| Covered by MapleSpike | ${totalCovered} |
| Not covered | ${totalUncovered} |
| Coverage rate | ${coveragePercentage}% |

## Coverage by Jurisdiction

### Federal
| Status | Count | Percentage |
|--------|-------|------------|
| Covered | ${analysis.federal.filter(p => isCovered(p.url, MODULE_SOURCES)).length} | ${((analysis.federal.filter(p => isCovered(p.url, MODULE_SOURCES)).length / analysis.federal.length) * 100).toFixed(1)}% |
| Not covered | ${analysis.federal.filter(p => !isCovered(p.url, MODULE_SOURCES)).length} | ${((analysis.federal.filter(p => !isCovered(p.url, MODULE_SOURCES)).length / analysis.federal.length) * 100).toFixed(1)}% |
| **Total** | **${analysis.federal.length}** | **100%** |

### Provincial
| Status | Count | Percentage |
|--------|-------|------------|
| Covered | ${analysis.provincial.filter(p => isCovered(p.url, MODULE_SOURCES)).length} | ${((analysis.provincial.filter(p => isCovered(p.url, MODULE_SOURCES)).length / analysis.provincial.length) * 100).toFixed(1)}% |
| Not covered | ${analysis.provincial.filter(p => !isCovered(p.url, MODULE_SOURCES)).length} | ${((analysis.provincial.filter(p => !isCovered(p.url, MODULE_SOURCES)).length / analysis.provincial.length) * 100).toFixed(1)}% |
| **Total** | **${analysis.provincial.length}** | **100%** |

### Municipal
| Status | Count | Percentage |
|--------|-------|------------|
| Covered | ${analysis.municipal.filter(p => isCovered(p.url, MODULE_SOURCES)).length} | ${((analysis.municipal.filter(p => isCovered(p.url, MODULE_SOURCES)).length / analysis.municipal.length) * 100).toFixed(1)}% |
| Not covered | ${analysis.municipal.filter(p => !isCovered(p.url, MODULE_SOURCES)).length} | ${((analysis.municipal.filter(p => !isCovered(p.url, MODULE_SOURCES)).length / analysis.municipal.length) * 100).toFixed(1)}% |
| **Total** | **${analysis.municipal.length}** | **100%** |

## Top-10 Uncovered Portals (by Population)

| Rank | Name | Type | Population | Jurisdiction | URL |
|------|------|------|------------|--------------|-----|
`;

  const prioritized = analysis.uncovered
    .filter(p => p.population > 0)
    .sort((a, b) => b.population - a.population)
    .slice(0, 10);

  prioritized.forEach((portal, index) => {
    report += `| ${index + 1} | ${portal.name} | ${portal.type} | ${portal.population.toLocaleString()} | ${portal.jurisdiction} | ${portal.url} |\n`;
  });

  report += `\n## Detailed Coverage List\n\n### Covered Portals (${totalCovered})\n\n`;
  analysis.covered.forEach(portal => {
    report += `- ✅ **${portal.name}** (${portal.population > 0 ? portal.population.toLocaleString() : 'N/A'} people) - ${portal.url}\n`;
  });

  report += `\n### Uncovered Portals (${totalUncovered})\n\n`;
  analysis.uncovered.forEach(portal => {
    report += `- ❌ **${portal.name}** (${portal.population > 0 ? portal.population.toLocaleString() : 'N/A'} people) - ${portal.url}\n`;
  });

  report += `\n## Recommendations\n\nBased on population and strategic importance, prioritize adding modules for:\n\n`;
  prioritized.slice(0, 5).forEach((portal, index) => {
    report += `${index + 1}. **${portal.name}** - ${portal.population.toLocaleString()} people, ${portal.type}\n`;
  });

  return report;
}

const portals = parseCSV(PORTAL_CSV);
const analysis = analyzeCoverage(portals, MODULE_SOURCES);
const report = generateMarkdownReport(analysis);

console.log(report);