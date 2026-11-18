// SPDX-License-Identifier: AGPL-3.0-only
import type { ExecutiveStatement } from './types.js';

export interface ExecutiveStory {
  topic: string;
  executive: string;
  company: string;
  date: string;
  summary: string;
  sourceUrl: string;
  statements: Array<{
    text: string;
    context: string;
  }>;
  relatedCommittees: string[];
}

const THEME_KEYWORDS: Record<string, string[]> = {
  financial: ['revenue', 'earnings', 'profit', 'income', 'financial result', 'dividend', 'buyback'],
  regulation: ['regulatory', 'compliance', 'regulation', 'licensed', 'approved', 'oversight'],
  restructuring: ['layoff', 'reduction in force', 'restructuring', 'downsize', 'reorg'],
  growth: ['expansion', 'growth', 'new market', 'investment', 'acquisition', 'scale'],
  technology: ['AI', 'digital', 'technology', 'innovation', 'automation', 'transformation'],
  canada: ['Canada', 'Canadian', 'domestic', 'national'],
  competition: ['competition', 'competitor', 'market share', 'pricing', 'competitive'],
  labour: ['union', 'workforce', 'employee', 'wage', 'salary', 'talent'],
  esg: ['climate', 'ESG', 'sustainable', 'net-zero', 'emissions', 'environment'],
  trade: ['tariff', 'trade', 'export', 'import', 'supply chain'],
};

function extractThemes(text: string): string[] {
  const lower = text.toLowerCase();
  const themes: string[] = [];
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      themes.push(theme);
    }
  }
  return themes;
}

function generateSummary(statements: ExecutiveStatement[]): string {
  const text = statements.map(s => s.text).join(' ');
  const themes = extractThemes(text);
  const primary = themes.slice(0, 3);
  const name = statements[0].executiveName;
  const org = statements[0].organization;
  const count = statements.length;
  if (primary.length === 0) {
    return `${name} of ${org} made ${count} statement(s) on ${statements[0].date}`;
  }
  return `${name} of ${org} addressed ${primary.join(', ')} across ${count} statement(s)`;
}

export function buildExecutiveStories(statements: ExecutiveStatement[]): ExecutiveStory[] {
  const grouped = new Map<string, ExecutiveStatement[]>();

  for (const stmt of statements) {
    const key = stmt.executiveName;
    const group = grouped.get(key);
    if (group) {
      group.push(stmt);
    } else {
      grouped.set(key, [stmt]);
    }
  }

  const stories: ExecutiveStory[] = [];

  for (const [, group] of grouped) {
    group.sort((a, b) => b.date.localeCompare(a.date));
    const first = group[0];

    const allThemes = new Set<string>();
    for (const stmt of group) {
      for (const t of stmt.topics) {
        allThemes.add(t);
      }
    }

    const topic = allThemes.size > 0 ? Array.from(allThemes).join(', ') : 'general';

    const relatedCommittees: string[] = [];
    for (const stmt of group) {
      if (stmt.committeeMeetingId && !relatedCommittees.includes(stmt.committeeMeetingId)) {
        relatedCommittees.push(stmt.committeeMeetingId);
      }
    }

    const storyStatements = group.map(s => ({
      text: s.excerpt ?? s.text.substring(0, 500),
      context: `${s.statementType} — ${s.title} (${s.date})`,
    }));

    stories.push({
      topic,
      executive: first.executiveName,
      company: first.organization,
      date: group[0].date,
      summary: generateSummary(group),
      sourceUrl: first.sourceUrl,
      statements: storyStatements,
      relatedCommittees,
    });
  }

  stories.sort((a, b) => b.date.localeCompare(a.date));
  return stories;
}
