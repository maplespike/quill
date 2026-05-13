// Self-contained real data fetcher — no pipeline-core dependencies
// Uses node fetch and simple XML parsing
//
// This script generates real-data.json (legacy) and then delegates
// to generate-pipeline-data.mjs for the full 13-source dataset.

import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://www.ourcommons.ca';
const CKAN_API = 'https://open.canada.ca/data/api/3/action';

async function fetchRealCommittees() {
  const results = [];
  const TARGETS = [
    { acr: 'PACP', name: 'Public Accounts', meetings: [33, 34] },
    { acr: 'ETHI', name: 'Access to Information, Privacy and Ethics', meetings: [46, 47] },
    { acr: 'FINA', name: 'Finance', meetings: [101, 102] },
    { acr: 'INDU', name: 'Industry and Technology', meetings: [70, 71] },
    { acr: 'SECU', name: 'Public Safety and National Security', meetings: [57, 58] },
    { acr: 'FAAE', name: 'Foreign Affairs', meetings: [43, 44] },
    { acr: 'ENVI', name: 'Environment', meetings: [66, 67] },
    { acr: 'NDDN', name: 'National Defence', meetings: [52, 53] },
    { acr: 'LANG', name: 'Official Languages', meetings: [18, 19] },
    { acr: 'JUST', name: 'Justice and Human Rights', meetings: [28, 29] },
  ];

  for (const t of TARGETS) {
    for (const m of t.meetings) {
      process.stdout.write(`${t.acr} #${m}...`);
      const url = `${BASE}/DocumentViewer/en/45-1/${t.acr}/meeting-${m}/evidence`;
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
        const html = await resp.text();
        
        // Extract XML URL from HTML
        const xmlMatch = html.match(/<a[^>]*class="[^"]*btn-export-xml[^"]*"[^>]*href="([^"]+)"/i);
        if (!xmlMatch) {
          process.stdout.write(`✗ no XML link\n`);
          continue;
        }
        const xmlUrl = xmlMatch[1].startsWith('/') ? BASE + xmlMatch[1] : xmlMatch[1];
        
        // Fetch and parse XML
        const xmlResp = await fetch(xmlUrl, { signal: AbortSignal.timeout(15000) });
        const xml = await xmlResp.text();
        
        // Simple XML parsing for basic fields
        const dateMatch = xml.match(/<DocumentDate[^>]*>([^<]+)/);
        const inCamera = xml.includes('InCameraNote') && !xml.includes('<InCameraNote/>');
        const titleMatch = xml.match(/<Title[^>]*>([^<]+)/i);
        
        // Count interventions
        const interventionMatches = xml.match(/<Intervention[ >]/g);
        const interventionCount = interventionMatches ? interventionMatches.length : 0;
        
        // Extract witnesses (speakers)
        const speakers = [...xml.matchAll(/<Speaker[^>]*>([^<]+)/g)].map(s => s[1].trim()).filter(Boolean);
        
        const record = {
          committee: t.acr,
          name: t.name,
          meeting: m,
          date: dateMatch ? dateMatch[1].trim() : 'Unknown',
          inCamera,
          witnesses: [...new Set(speakers)].slice(0, 10),
          interventionCount,
          source: url,
          xmlSource: xmlUrl,
        };
        results.push(record);
        process.stdout.write(`${inCamera ? '🔒' : '✅'} ${dateMatch ? dateMatch[1].trim().slice(0,20) : '?'} (${interventionCount} interventions)\n`);
      } catch(e) {
        process.stdout.write(`✗ ${e.message.slice(0,50)}\n`);
      }
    }
  }
  return results;
}

const meetings = await fetchRealCommittees();
const inCamera = meetings.filter(r => r.inCamera);

// Also fetch lobbying dataset info
let lobbyingInfo = null;
try {
  const ckanResp = await fetch(`${CKAN_API}/package_show?id=70ef2117-1095-4d77-80eb-b87f2bada2a4`, { signal: AbortSignal.timeout(10000) });
  const ckanData = await ckanResp.json();
  if (ckanData.success) {
    lobbyingInfo = {
      title: ckanData.result.title,
      resources: (ckanData.result.resources || []).map(r => ({ format: r.format, url: r.url })),
    };
  }
} catch(e) {}

const output = {
  generatedAt: new Date().toISOString(),
  stats: {
    committees: meetings.length,
    inCamera: inCamera.length,
    totalInterventions: meetings.reduce((s, m) => s + m.interventionCount, 0),
  },
  meetings,
  inCameraMeetings: inCamera,
  lobbyingInfo,
};

writeFileSync('assets/real-data.json', JSON.stringify(output, null, 2));
console.log(`\n✅ ${meetings.length} meetings, ${inCamera.length} in-camera, ${output.stats.totalInterventions} total interventions`);
console.log('Saved to assets/real-data.json');

// Delegate to the full pipeline data generator
console.log('\n--- Delegating to generate-pipeline-data.mjs ---');
try {
  const scriptPath = resolve(__dirname, 'generate-pipeline-data.mjs');
  execSync(`node "${scriptPath}"`, { cwd: resolve(__dirname, '..'), stdio: 'inherit' });
} catch (e) {
  console.error('Pipeline data generation had errors (check above for details)');
}
