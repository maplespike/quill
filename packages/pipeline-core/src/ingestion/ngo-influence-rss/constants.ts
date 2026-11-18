// SPDX-License-Identifier: AGPL-3.0-only
import type { NgoRssConfig } from './types.js';

/** NGO & influence RSS sources for narrative tracking */
export const NGO_RSS_SOURCES: NgoRssConfig[] = [
  // ── Think Tanks ──────────────────────────────────────
  { name: 'Fraser Institute', url: 'https://www.fraserinstitute.org/rss.xml', category: 'think-tank', description: 'Economic policy papers and commentary', enabled: true, narrativeTags: ['economic-policy', 'taxation', 'fiscal'] },
  { name: 'C.D. Howe Institute', url: 'https://www.cdhowe.org/rss.xml', category: 'think-tank', description: 'Public policy research and analysis', enabled: true, narrativeTags: ['economic-policy', 'regulation', 'governance'] },
  { name: 'Macdonald-Laurier Institute', url: 'https://macdonaldlaurier.ca/feed/', category: 'think-tank', description: 'National security, Indigenous, energy policy', enabled: true, narrativeTags: ['national-security', 'indigenous', 'energy'] },
  { name: 'IRPP (Policy Options)', url: 'https://policyoptions.irpp.org/feed/', category: 'think-tank', description: 'Public policy magazine', enabled: true, narrativeTags: ['public-policy', 'social-policy', 'governance'] },
  { name: 'CIGI', url: 'https://www.cigionline.org/rss.xml', category: 'think-tank', description: 'International governance and innovation', enabled: true, narrativeTags: ['foreign-policy', 'governance', 'technology'] },
  { name: 'Conference Board of Canada', url: 'https://www.conferenceboard.ca/feed/', category: 'think-tank', description: 'Economic forecasts and research', enabled: true, narrativeTags: ['economic-policy', 'forecasts'] },
  { name: 'Canada West Foundation', url: 'https://cwf.ca/feed/', category: 'think-tank', description: 'Western Canada policy research', enabled: true, narrativeTags: ['regional-policy', 'western-canada'] },
  { name: 'Broadbent Institute', url: 'https://www.broadbentinstitute.ca/feed/', category: 'think-tank', description: 'Progressive policy research', enabled: true, narrativeTags: ['progressive', 'social-policy', 'inequality'] },
  { name: 'Canadian Taxpayers Federation', url: 'https://www.taxpayer.com/rss', category: 'think-tank', description: 'Fiscal accountability advocacy', enabled: true, narrativeTags: ['fiscal', 'taxation', 'accountability'] },
  { name: 'Canadian Centre for Policy Alternatives', url: 'https://www.policyalternatives.ca/feed/', category: 'think-tank', description: 'Progressive alternative policy', enabled: true, narrativeTags: ['progressive', 'social-policy', 'inequality'] },
  { name: 'Cardus', url: 'https://www.cardus.ca/feed/', category: 'think-tank', description: 'Social policy and faith', enabled: true, narrativeTags: ['social-policy', 'faith', 'family'] },
  { name: 'Rideau Institute', url: 'https://www.rideauinstitute.ca/feed/', category: 'think-tank', description: 'Peace, security, and defence policy', enabled: true, narrativeTags: ['defence', 'security', 'foreign-policy'] },
  { name: 'International Crisis Group', url: 'https://www.crisisgroup.org/rss', category: 'think-tank', description: 'Conflict analysis and resolution', enabled: true, narrativeTags: ['conflict', 'international-security', 'foreign-policy'] },

  // ── NGOs & Non-Profits ───────────────────────────────
  { name: 'UNHCR Global News', url: 'https://www.unhcr.org/rss.xml', category: 'un-international', description: 'UNHCR global news', enabled: true, narrativeTags: ['refugee', 'asylum', 'humanitarian'] },
  { name: 'UN News', url: 'https://news.un.org/feed/', category: 'un-international', description: 'UN general news', enabled: true, narrativeTags: ['un', 'international', 'global-governance'] },
  { name: 'WTO News', url: 'https://www.wto.org/english/news_e/news_e.rss', category: 'un-international', description: 'World Trade Organization news', enabled: true, narrativeTags: ['trade', 'international', 'tariffs'] },
  { name: 'Canadian Red Cross', url: 'https://www.redcross.ca/feed/', category: 'ngo', description: 'Humanitarian response', enabled: true, narrativeTags: ['humanitarian', 'disaster', 'health'] },
  { name: 'Amnesty International Canada', url: 'https://www.amnesty.ca/feed/', category: 'ngo', description: 'Human rights advocacy', enabled: true, narrativeTags: ['human-rights', 'advocacy'] },
  { name: 'David Suzuki Foundation', url: 'https://davidsuzuki.org/feed/', category: 'ngo', description: 'Environmental policy', enabled: true, narrativeTags: ['environment', 'climate', 'conservation'] },
  { name: 'World Wildlife Fund Canada', url: 'https://wwf.ca/feed/', category: 'ngo', description: 'Wildlife conservation', enabled: true, narrativeTags: ['conservation', 'species', 'environment'] },
  { name: 'Canadian Bar Association', url: 'https://www.cba.org/feed', category: 'ngo', description: 'Legal policy advocacy', enabled: true, narrativeTags: ['legal-policy', 'justice', 'law'] },
  { name: 'Canadian Medical Association', url: 'https://www.cma.ca/feed', category: 'ngo', description: 'Health policy', enabled: true, narrativeTags: ['health-policy', 'physicians', 'healthcare'] },
  { name: 'Oxfam Canada', url: 'https://www.oxfam.ca/feed/', category: 'ngo', description: 'International development and poverty', enabled: true, narrativeTags: ['development', 'poverty', 'humanitarian'] },
  { name: 'Transparency International Canada', url: 'https://transparencycanada.ca/feed/', category: 'ngo', description: 'Anti-corruption advocacy', enabled: true, narrativeTags: ['corruption', 'accountability', 'governance'] },

  // ── WEF Alternatives ─────────────────────────────────
  { name: 'WEF rss.app Generator', url: 'https://rss.app/rss-feed/world-economic-forum-rss-feed', category: 'wef-alternative', description: 'WEF press releases via third-party generator', enabled: true, narrativeTags: ['wef', 'global-governance', 'davos', 'influence'] },
  { name: 'PR Newswire WEF', url: 'https://www.prnewswire.com/news-releases/latest-news-topics/world-economic-forum/', category: 'wef-alternative', description: 'WEF announcements via PR Newswire', enabled: true, narrativeTags: ['wef', 'corporate', 'davos', 'announcements'] },

  // ── Government RSS (supplemental to Gazette) ────────
  { name: 'Canada Gazette Part I', url: 'https://www.gazette.gc.ca/rss/p1-eng.xml', category: 'government-rss', description: 'Notices and proposed regulations', enabled: true, narrativeTags: ['regulation', 'government', 'notices'] },
  { name: 'Canada Gazette Part II', url: 'https://www.gazette.gc.ca/rss/p2-eng.xml', category: 'government-rss', description: 'Official regulations', enabled: true, narrativeTags: ['regulation', 'government', 'law'] },
  { name: 'Canada Gazette Part III', url: 'https://www.gazette.gc.ca/rss/en-ls-eng.xml', category: 'government-rss', description: 'Acts of Parliament', enabled: true, narrativeTags: ['legislation', 'government', 'parliament'] },
  { name: 'PM of Canada News', url: 'https://pm.gc.ca/en/news.rss', category: 'government-rss', description: 'PM statements and announcements', enabled: true, narrativeTags: ['executive', 'government', 'policy'] },
  { name: 'Global Affairs Canada', url: 'https://www.international.gc.ca/international/news-nouvelles.aspx?lang=eng&rss=1', category: 'government-rss', description: 'Foreign policy news', enabled: true, narrativeTags: ['foreign-policy', 'diplomacy', 'trade'] },
  { name: 'Justice Canada', url: 'https://www.justice.gc.ca/eng/news-nouv/rss.html', category: 'government-rss', description: 'Justice and prosecutions news', enabled: true, narrativeTags: ['justice', 'courts', 'prosecutions'] },
];

/** 5GW narrative tags mapped to risk weight */
export const NARRATIVE_TAG_WEIGHTS: Record<string, number> = {
  'wef': 0.9,
  'global-governance': 0.8,
  'foreign-policy': 0.7,
  'influence': 0.8,
  'regulation': 0.4,
  'economic-policy': 0.5,
  'trade': 0.6,
  'human-rights': 0.3,
};

/** Default fetch timeout per source in ms */
export const NGO_RSS_FETCH_TIMEOUT_MS = 30_000;

/** Max items per source per fetch */
export const MAX_ITEMS_PER_SOURCE = 50;

/** User agent for RSS fetches */
export const NGO_RSS_USER_AGENT = 'MapleSpike-NGO-Influence/1.0 (+https://github.com/reverb256/quill)';
