// SPDX-License-Identifier: AGPL-3.0-only
import type { D1Database } from './db.js';
import type { Intervention } from './types.js';

export interface EvidenceStory {
  topic: string;
  committee: string;
  date: string;
  keySpeakers: Array<{
    name: string;
    party: string;
    quote: string;
  }>;
  recommendations: string[];
  sourceUrl: string;
}

interface InterventionRow extends Intervention {
  committee_acronym: string;
  meeting_number: number;
  date: string;
  in_camera: number;
  evidence_url: string;
  subject: string | null;
}

const RECOMMENDATION_RE = /\b(recommend|recommends|recommendation|should|must|urge|urges|call\s+on|calls\s+on|request\s+that|propose|proposes|proposed|suggest|suggests|suggestion)\b/i;

export function buildEvidenceStories(interventions: Intervention[]): EvidenceStory[] {
  const rows = interventions as InterventionRow[];

  const grouped = new Map<string, InterventionRow[]>();
  for (const row of rows) {
    const key = `${row.committee_acronym ?? 'unknown'}-${row.meeting_number ?? 0}`;
    const group = grouped.get(key);
    if (group) {
      group.push(row);
    } else {
      grouped.set(key, [row]);
    }
  }

  const stories: EvidenceStory[] = [];
  for (const [, group] of grouped) {
    const first = group[0];
    const keySpeakers: EvidenceStory['keySpeakers'] = [];
    const recommendations: string[] = [];
    const seen = new Set<string>();

    for (const row of group) {
      const text = row.text.trim();
      if (!text || text.length < 20) continue;

      const dedupKey = `${row.speakerName}:${text.slice(0, 60)}`;
      if (!seen.has(dedupKey) && text.length > 100) {
        seen.add(dedupKey);
        keySpeakers.push({
          name: row.speakerName,
          party: row.speakerParty ?? '',
          quote: text,
        });
      }

      if (RECOMMENDATION_RE.test(text)) {
        recommendations.push(text);
      }
    }

    stories.push({
      topic: first.subject ?? `${first.committee_acronym ?? 'Committee'} Meeting #${first.meeting_number ?? 0}`,
      committee: first.committee_acronym ?? '',
      date: first.date ?? '',
      keySpeakers,
      recommendations,
      sourceUrl: first.evidence_url ?? '',
    });
  }

  stories.sort((a, b) => b.date.localeCompare(a.date));
  return stories;
}

export async function searchCommitteeEvidence(
  db: D1Database,
  query: string,
  limit?: number,
): Promise<EvidenceStory[]> {
  const sql = `
    SELECT ci.*, cm.committee_acronym, cm.meeting_number, cm.date, cm.in_camera, cm.evidence_url, cm.subject
    FROM committee_interventions ci
    JOIN committee_meetings cm ON ci.meeting_id = cm.id
    WHERE ci.text LIKE ?
    ORDER BY cm.date DESC, ci.sequence ASC
    LIMIT ?
  `;
  const stmt = db.prepare(sql).bind(`%${query}%`, limit ?? 50);
  const result = await stmt.all<InterventionRow>();
  return buildEvidenceStories(result.results ?? []);
}
