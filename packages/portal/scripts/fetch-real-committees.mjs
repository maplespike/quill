// Standalone script to fetch real committee data from ourcommons.ca
// Uses Node.js built-in fetch (no dependencies)

const BASE = 'https://www.ourcommons.ca';

async function fetchMeetingList(acronym) {
  const url = `${BASE}/Committees/en/${acronym}/Meetings`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const html = await resp.text();
  const meetings = [...new Set([...html.matchAll(/meeting-(\d+)/g)].map(m => parseInt(m[1])))].slice(0, 3);
  return meetings;
}

async function fetchMeetingData(acronym, num) {
  const url = `${BASE}/DocumentViewer/en/45-1/${acronym}/meeting-${num}/evidence`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const html = await resp.text();
    const titleM = html.match(/<title>([^<]*)<\/title>/);
    const dateM = html.match(/Date[:\s]*([A-Za-z]+day,\s+[A-Za-z]+\s+\d+,\s+\d{4})/i);
    const inCamera = html.includes('InCameraNote') || html.toLowerCase().includes('in camera');
    const witnessM = html.match(/<meta[^>]*name=["']?Witnesses["']?[^>]*content=["']([^"']*)/i);
    return {
      committee: acronym, meeting: num,
      title: titleM ? titleM[1].trim() : `Meeting #${num}`,
      date: dateM ? dateM[1].trim() : 'Unknown',
      inCamera, witnesses: witnessM ? witnessM[1].split(',').map(s => s.trim()) : [],
      source: url
    };
  } catch (e) {
    return { committee: acronym, meeting: num, error: e.message, source: url };
  }
}

const ALL = ['PACP','ETHI','FINA','SECU','INDU','FAAE','NDDN','ENVI','ACVA','LANG','JUST','HESA','CIIT','OGGO','PROC','RNNR','SRSR','TRAN','CHPC','CIMM','FEWO','FOPO','HUMA','INAN','LIAI','AMAD','BCAN','BILI','REGS'];
const results = [];

for (const c of ALL) {
  process.stdout.write(`${c}...`);
  try {
    const meetings = await fetchMeetingList(c);
    for (const m of meetings) {
      const data = await fetchMeetingData(c, m);
      results.push(data);
      process.stdout.write(`#${m} `);
    }
    process.stdout.write(`(${meetings.length} meetings)\n`);
  } catch(e) {
    process.stdout.write(`ERROR: ${e.message.slice(0,50)}\n`);
  }
}

const realCommittees = results.filter(r => !r.error).slice(0, 50);
const inCamera = realCommittees.filter(r => r.inCamera);

const fs = await import('fs');
fs.writeFileSync('/data/projects/own/maplespike/packages/portal/assets/real-committees.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalFetched: results.length,
  totalOk: realCommittees.length,
  inCameraCount: inCamera.length,
  committees: realCommittees
}, null, 2));

console.log(`\nDone! ${realCommittees.length} meetings fetched (${inCamera.length} in-camera)`);
console.log(`Saved to assets/real-committees.json`);
