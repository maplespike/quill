/**
 * Fifth-Generation Warfare Defense — Quill
 *
 * Analyzes content for foreign influence and narrative manipulation patterns
 * characteristic of fifth-generation warfare (5GW):
 *   - Coordinated inauthentic amplification
 *   - Narrative seeding / agenda-setting
 *   - Wedge issues and social polarisation
 *   - Source obfuscation and false-flag attribution
 *
 * AI-powered analysis is optional (useAIGateway). By default the class
 * uses rule-based heuristics, making it safe to run offline or air-gapped.
 *
 * Reference: TRACKED_INFLUENCE_ACTORS from the influence module for
 * known bad-actor matching.
 */

import { TRACKED_INFLUENCE_ACTORS } from '../ingestion/influence/constants.js';
import type { InfluenceActor } from '../ingestion/influence/types.js';

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

export interface FiveGWDefenseConfig {
  /** AI Gateway endpoint (OpenAI-compatible chat completions) */
  endpoint?: string;
  /** Model name to use for AI-powered analysis */
  model?: string;
  /** API key (if required) */
  apiKey?: string;
  /** Enable AI-powered analysis (default: false — rule-based only) */
  useAIGateway?: boolean;
  /** Maximum retries for AI gateway calls */
  maxRetries?: number;
  /** Minimum threat score to flag (0-100, default: 30) */
  flagThreshold?: number;
  /** Custom list of adversarial source domains */
  adversarialSources?: string[];
}

const USER_AGENT = 'MapleSpike/0.2 (+https://maplespike.lan)';

const DEFAULT_CONFIG: Required<FiveGWDefenseConfig> = {
  endpoint: 'http://127.0.0.1:8080/v1',
  model: 'qwen3.5-27b',
  apiKey: '',
  useAIGateway: false,
  maxRetries: 1,
  flagThreshold: 30,
  adversarialSources: [
    'rt.com', 'sputniknews.com', 'tass.com', 'russia-news',
    'farsnews.ir', 'presstv.ir',
    'almanar.com.lb', 'almayadeen.net',
  ],
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type FiveGWThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface FiveGWPattern {
  type:
    | 'coordinated-inauthentic-amplification'
    | 'narrative-seeding'
    | 'wedge-issue'
    | 'source-obfuscation'
    | 'astroturfing'
    | 'adversarial-narrative'
    | 'false-flag'
    | 'other';
  description: string;
  severity: number;          // 0-100
  evidence: string[];
}

export interface TrackedActorMatch {
  actorId: string;
  actorName: string;
  matchType: 'source' | 'affiliation' | 'narrative-alignment' | 'other';
  confidence: number;        // 0-100
}

export interface FiveGWAnalysisResult {
  /** Aggregate threat score 0-100 */
  threatScore: number;
  /** Computed threat level from score */
  threatLevel: FiveGWThreatLevel;
  /** Individual patterns detected */
  patterns: FiveGWPattern[];
  /** Overall confidence in the assessment (0-100) */
  confidence: number;
  /** Recommended action for downstream systems */
  recommendedAction: string;
  /** Known influence actors matched during analysis */
  matchAgainstTrackedActors: TrackedActorMatch[];
  /** Human-readable summary */
  summary: string;
  /** Whether this result came from rule-based heuristics vs AI */
  ruleBased: boolean;
}

/* ------------------------------------------------------------------ */
/*  Default / Fallback Result                                          */
/* ------------------------------------------------------------------ */

export function defaultFiveGWResult(): FiveGWAnalysisResult {
  return {
    threatScore: 0,
    threatLevel: 'none',
    patterns: [],
    confidence: 0,
    recommendedAction: 'none',
    matchAgainstTrackedActors: [],
    summary: 'No 5GW indicators detected (analysis skipped or failed)',
    ruleBased: true,
  };
}

/* ------------------------------------------------------------------ */
/*  Rule-Based Heuristics                                              */
/* ------------------------------------------------------------------ */

/**
 * Common narrative-seeding phrases used in adversarial influence ops.
 * Drawn from open-source intelligence (OSINT) literature on Russian,
 * Chinese, and Iranian information warfare.
 */
const NARRATIVE_SEED_KEYWORDS: Record<string, number> = {
  'west is in decline': 65,
  'western decadence': 60,
  'american empire': 55,
  'us hegemony': 55,
  'nato aggression': 70,
  'nato expansion': 60,
  'ukraine nazi': 80,
  'bioweapon': 75,
  'biolab': 70,
  'deep state': 50,
  'globalist elite': 60,
  'new world order': 65,
  'great reset': 55,
  'cultural marxism': 65,
  'woke agenda': 40,
  'white genocide': 80,
  'replacement theory': 75,
  'china virus': 55,
  'kung flu': 60,
  'election fraud': 50,
  'stolen election': 50,
  'rigged election': 50,
  'mainstream media lies': 35,
  'fake news mainstream': 35,
  'western sanctions illegal': 60,
  'unipolar world ending': 65,
  'multipolar world': 50,
  'eurasian integration': 50,
  'information war': 45,
  'hybrid war': 50,
  'color revolution': 65,
  'western proxy': 55,
  'foreign agent': 60,
  'unacceptable interference': 55,
};

/**
 * Wedge-issue topics commonly exploited by adversarial influence ops
 * to polarize and destabilize.
 */
const WEDGE_ISSUE_KEYWORDS: Record<string, number> = {
  immigration: 40,
  'border crisis': 60,
  'illegal immigration': 45,
  'cultural war': 50,
  'critical race theory': 45,
  'lgbtq indoctrination': 60,
  'grooming': 65,
  'pedophile ring': 75,
  'adrenochrome': 85,
  'elite pedophile': 80,
  'vaccine mandate tyranny': 60,
  'medical tyranny': 55,
  'freedom convoy': 40,
  'trump': 30,
  'cancel culture': 35,
  'woke military': 45,
  'antisemitism': 35,
  'islamophobia': 35,
  'white privilege': 40,
  'systemic racism': 30,
};

/**
 * Source obfuscation indicators — patterns that suggest the real origin
 * of content is being hidden.
 */
const SOURCE_OBFUSCATION_PATTERNS = [
  /according to sources (who|that)/i,
  /anonymous (officials|sources|intelligence)/i,
  /unnamed (officials|sources|diplomats)/i,
  /leaked (documents|emails|recordings)/i,
  /whistleblower (claims|reveals|alleges)/i,
  /a (source|person) familiar with/i,
  /not independently verified/i,
  /cannot be independently (verified|confirmed)/i,
  /screenshots (show|reveal|appear)/i,
  /social media posts (show|claim|allege)/i,
];

/**
 * Coordinated inauthentic amplification indicators.
 */
const COORDINATED_AMPLIFICATION_PATTERNS = [
  /share this (widely|far and wide|everywhere)/i,
  /copy and paste (this|the following)/i,
  /signal boost/i,
  /viral (campaign|movement|challenge)/i,
  /trending (on|topic)/i,
  /coordinated (posting|sharing|amplification)/i,
  /hashtag campaign/i,
  /bot (army|network|activity)/i,
];

/** Map a numeric score to a threat level. */
function scoreToThreatLevel(score: number): FiveGWThreatLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'none';
}

/** Map threat level to a recommended action string. */
function threatLevelToAction(level: FiveGWThreatLevel): string {
  switch (level) {
    case 'critical':
      return 'immediate-review — escalate to human analyst and block distribution';
    case 'high':
      return 'flag-for-review — quarantine pending analyst assessment';
    case 'medium':
      return 'monitor — tag for additional scrutiny in downstream curation';
    case 'low':
      return 'log — note but take no action';
    case 'none':
      return 'none';
  }
}

/* ------------------------------------------------------------------ */
/*  Adversarial Source Checking                                        */
/* ------------------------------------------------------------------ */

function checkAdversarialSources(
  source: string,
  adversarialDomains: string[],
): { match: boolean; matchedDomain: string | null } {
  const src = source.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  for (const domain of adversarialDomains) {
    if (src.includes(domain)) {
      return { match: true, matchedDomain: domain };
    }
  }
  return { match: false, matchedDomain: null };
}

/* ------------------------------------------------------------------ */
/*  Actor Matching                                                     */
/* ------------------------------------------------------------------ */

function matchTrackedActors(
  text: string,
  source: string,
): TrackedActorMatch[] {
  const matches: TrackedActorMatch[] = [];
  const lower = text.toLowerCase();
  const srcLower = source.toLowerCase();

  for (const actor of TRACKED_INFLUENCE_ACTORS) {
    // Check source name match
    if (srcLower.includes(actor.name.toLowerCase())) {
      matches.push({
        actorId: actor.id,
        actorName: actor.name,
        matchType: 'source',
        confidence: 95,
      });
      continue;
    }

    // Check alias matches in source
    for (const alias of actor.aliases) {
      if (srcLower.includes(alias.toLowerCase())) {
        matches.push({
          actorId: actor.id,
          actorName: actor.name,
          matchType: 'source',
          confidence: 90,
        });
        break;
      }
    }

    // Check mentions of the actor in content body
    if (lower.includes(actor.name.toLowerCase())) {
      matches.push({
        actorId: actor.id,
        actorName: actor.name,
        matchType: 'affiliation',
        confidence: 70,
      });
    } else {
      for (const alias of actor.aliases) {
        if (lower.includes(alias.toLowerCase())) {
          matches.push({
            actorId: actor.id,
            actorName: actor.name,
            matchType: 'affiliation',
            confidence: 65,
          });
          break;
        }
      }
    }
  }

  // Deduplicate by actorId, keeping highest confidence
  const seen = new Map<string, TrackedActorMatch>();
  for (const m of matches) {
    const existing = seen.get(m.actorId);
    if (!existing || m.confidence > existing.confidence) {
      seen.set(m.actorId, m);
    }
  }

  return Array.from(seen.values());
}

/* ------------------------------------------------------------------ */
/*  Heuristic Analysis                                                 */
/* ------------------------------------------------------------------ */

interface HeuristicResult {
  patterns: FiveGWPattern[];
  score: number;
  confidence: number;
}

function heuristicAnalysis(
  content: string,
  source: string,
  title: string,
  adversarialDomains: string[],
): HeuristicResult {
  const patterns: FiveGWPattern[] = [];
  let totalSeverity = 0;
  const textBlock = `${title}\n${content}`.toLowerCase();

  // --- 1. Adversarial source check ---
  const srcMatch = checkAdversarialSources(source, adversarialDomains);
  if (srcMatch.match) {
    patterns.push({
      type: 'adversarial-narrative',
      description: `Content originates from known adversarial source: ${srcMatch.matchedDomain}`,
      severity: 85,
      evidence: [`Source domain: ${srcMatch.matchedDomain}`],
    });
    totalSeverity += 85;
  }

  // --- 2. Narrative seeding keyword detection ---
  const narrativeHits: { phrase: string; severity: number }[] = [];
  for (const [phrase, severity] of Object.entries(NARRATIVE_SEED_KEYWORDS)) {
    if (textBlock.includes(phrase)) {
      narrativeHits.push({ phrase, severity });
    }
  }
  if (narrativeHits.length > 0) {
    const avgSev = Math.round(
      narrativeHits.reduce((s, h) => s + h.severity, 0) / narrativeHits.length,
    );
    patterns.push({
      type: 'narrative-seeding',
      description: `Detected ${narrativeHits.length} narrative-seeding keyword(s) characteristic of adversarial influence operations`,
      severity: Math.min(avgSev + narrativeHits.length * 3, 100),
      evidence: narrativeHits.map(h => `"${h.phrase}" (severity: ${h.severity})`),
    });
    totalSeverity += avgSev;
  }

  // --- 3. Wedge issue detection ---
  const wedgeHits: { phrase: string; severity: number }[] = [];
  for (const [phrase, severity] of Object.entries(WEDGE_ISSUE_KEYWORDS)) {
    if (textBlock.includes(phrase)) {
      wedgeHits.push({ phrase, severity });
    }
  }
  if (wedgeHits.length > 0) {
    const avgSev = Math.round(
      wedgeHits.reduce((s, h) => s + h.severity, 0) / wedgeHits.length,
    );
    patterns.push({
      type: 'wedge-issue',
      description: `Content exploits ${wedgeHits.length} polarising wedge issue(s) commonly targeted by influence operations`,
      severity: Math.min(avgSev + wedgeHits.length * 2, 100),
      evidence: wedgeHits.map(h => `"${h.phrase}" (severity: ${h.severity})`),
    });
    totalSeverity += avgSev;
  }

  // --- 4. Source obfuscation detection ---
  const obfuscationHits: string[] = [];
  for (const regex of SOURCE_OBFUSCATION_PATTERNS) {
    const match = textBlock.match(regex);
    if (match) {
      obfuscationHits.push(match[0].trim());
    }
  }
  if (obfuscationHits.length > 0) {
    const sev = Math.min(30 + obfuscationHits.length * 10, 90);
    patterns.push({
      type: 'source-obfuscation',
      description: `Content uses ${obfuscationHits.length} source obfuscation pattern(s) that may hide true origin`,
      severity: sev,
      evidence: obfuscationHits,
    });
    totalSeverity += sev;
  }

  // --- 5. Coordinated amplification detection ---
  const ampHits: string[] = [];
  for (const regex of COORDINATED_AMPLIFICATION_PATTERNS) {
    const match = textBlock.match(regex);
    if (match) {
      ampHits.push(match[0].trim());
    }
  }
  if (ampHits.length > 0) {
    const sev = Math.min(40 + ampHits.length * 10, 90);
    patterns.push({
      type: 'coordinated-inauthentic-amplification',
      description: `Content exhibits ${ampHits.length} indicator(s) of coordinated inauthentic amplification`,
      severity: sev,
      evidence: ampHits,
    });
    totalSeverity += sev;
  }

  // Aggregate score (0-100, weighted by number of pattern categories)
  const patternCount = patterns.length;
  const score = patternCount > 0
    ? Math.min(Math.round(totalSeverity / patternCount), 100)
    : 0;

  // Confidence: more distinct patterns = higher confidence
  const confidence = patternCount > 0
    ? Math.min(40 + patternCount * 12 + (srcMatch.match ? 15 : 0), 98)
    : 10;

  return { patterns, score, confidence };
}

/* ------------------------------------------------------------------ */
/*  AI Gateway Integration                                             */
/* ------------------------------------------------------------------ */

interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

async function chatComplete(
  config: Required<FiveGWDefenseConfig>,
  prompt: string,
  options: ChatCompletionOptions = {},
): Promise<string> {
  const { temperature = 0.3, maxTokens = 1500, jsonMode = true } = options;
  const endpoint = config.endpoint.replace(/\/$/, '');

  const body: Record<string, unknown> = {
    model: config.model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} — ${errorText}`);
  }

  const data: any = await response.json();
  return data.choices[0].message.content;
}

const FIVE_GW_ANALYSIS_PROMPT = `You are a fifth-generation warfare (5GW) analyst for a Canadian sovereignty intelligence platform.
Analyze the following content for foreign influence and narrative manipulation patterns.

Assess these dimensions (0-100):
1. COORDINATED_INAUTHENTIC_AMPLIFICATION: Bot-like language, call-to-share, astroturfing indicators
2. NARRATIVE_SEEDING: Adversarial talking points, divisive framing, information-warfare narratives
3. WEDGE_ISSUE_EXPLOITATION: Deliberate polarisation on race, immigration, vaccines, etc.
4. SOURCE_OBFUSCATION: Vague/anonymous sourcing, fake grassroots, hidden attribution
5. ADVERSARIAL_NARRATIVE: Narrative that directly benefits a foreign adversary's strategic objectives

Also identify:
- Any known influence actors mentioned (from the tracked list)
- Overall threat assessment

Respond ONLY with valid JSON:
{
  "threatScore": number (0-100),
  "patterns": [
    {
      "type": "coordinated-inauthentic-amplification|narrative-seeding|wedge-issue|source-obfuscation|adversarial-narrative|false-flag|other",
      "description": "string",
      "severity": number (0-100),
      "evidence": ["string"]
    }
  ],
  "confidence": number (0-100),
  "recommendedAction": "string",
  "summary": "string",
  "matchedActorIds": ["actor-id-if-any"]
}`;

async function aiAnalysis(
  config: Required<FiveGWDefenseConfig>,
  content: string,
  source: string,
  title: string,
): Promise<FiveGWAnalysisResult | null> {
  const prompt = `${FIVE_GW_ANALYSIS_PROMPT}

Title: ${title}
Source: ${source}
Content:
${content.slice(0, 4000)}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const raw = await chatComplete(config, prompt, {
        temperature: 0.3,
        maxTokens: 1500,
      });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in AI response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Resolve matched actor IDs into TrackedActorMatch objects
      const actorMatches: TrackedActorMatch[] = [];
      if (Array.isArray(parsed.matchedActorIds)) {
        for (const id of parsed.matchedActorIds) {
          const actor = TRACKED_INFLUENCE_ACTORS.find((a: InfluenceActor) => a.id === id);
          if (actor) {
            actorMatches.push({
              actorId: actor.id,
              actorName: actor.name,
              matchType: 'narrative-alignment',
              confidence: 75,
            });
          }
        }
      }

      const threatLevel = scoreToThreatLevel(parsed.threatScore ?? 0);

      return {
        threatScore: parsed.threatScore ?? 0,
        threatLevel,
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
        confidence: parsed.confidence ?? 50,
        recommendedAction: parsed.recommendedAction ?? threatLevelToAction(threatLevel),
        matchAgainstTrackedActors: actorMatches,
        summary: parsed.summary ?? 'AI analysis completed',
        ruleBased: false,
      };
    } catch (error) {
      lastError = error as Error;
      console.error(`[5GW-AI] Attempt ${attempt + 1} failed:`, lastError.message);
      if (attempt < config.maxRetries && lastError.message.includes('429')) {
        const delay = 60_000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  console.error('[5GW-AI] All attempts failed, falling back to rule-based analysis');
  return null;
}

/* ------------------------------------------------------------------ */
/*  Main Class                                                         */
/* ------------------------------------------------------------------ */

export class FifthGenerationWarfareDefense {
  private config: Required<FiveGWDefenseConfig>;

  constructor(config: Partial<FiveGWDefenseConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze content for fifth-generation warfare indicators.
   *
   * If `useAIGateway` is true and the endpoint is reachable, an LLM-based
   * analysis is attempted. On failure (or by default), rule-based heuristics
   * provide the assessment.
   */
  async analyze(
    content: string,
    source: string,
    title?: string,
  ): Promise<FiveGWAnalysisResult> {
    const safeTitle = title || '(no title)';

    // --- AI-powered path (optional) ---
    if (this.config.useAIGateway) {
      try {
        const aiResult = await aiAnalysis(this.config, content, source, safeTitle);
        if (aiResult !== null) return aiResult;
      } catch {
        // Fall through to rule-based
      }
    }

    // --- Rule-based heuristic analysis (default) ---
    const heuristic = heuristicAnalysis(content, source, safeTitle, this.config.adversarialSources);
    const actorMatches = matchTrackedActors(`${safeTitle}\n${content}`, source);

    const threatLevel = scoreToThreatLevel(heuristic.score);

    // Boost threat score if tracked actors are matched
    let finalScore = heuristic.score;
    if (actorMatches.some(m => m.matchType === 'source' && m.confidence >= 90)) {
      finalScore = Math.min(finalScore + 15, 100);
    }

    return {
      threatScore: finalScore,
      threatLevel,
      patterns: heuristic.patterns,
      confidence: heuristic.confidence,
      recommendedAction: threatLevelToAction(threatLevel),
      matchAgainstTrackedActors: actorMatches,
      summary: buildSummary(heuristic.patterns, finalScore, threatLevel, actorMatches),
      ruleBased: true,
    };
  }

  /**
   * Quick synchronous check — runs only rule-based heuristics.
   * Useful for pre-filtering large volumes before AI analysis.
   */
  quickCheck(
    content: string,
    source: string,
    title?: string,
  ): Pick<FiveGWAnalysisResult, 'threatScore' | 'threatLevel' | 'patterns' | 'confidence'> {
    const safeTitle = title || '(no title)';
    const heuristic = heuristicAnalysis(content, source, safeTitle, this.config.adversarialSources);
    return {
      threatScore: heuristic.score,
      threatLevel: scoreToThreatLevel(heuristic.score),
      patterns: heuristic.patterns,
      confidence: heuristic.confidence,
    };
  }

  /**
   * Return the current configuration (useful for diagnostics).
   */
  getConfig(): Readonly<Required<FiveGWDefenseConfig>> {
    return { ...this.config };
  }
}

/* ------------------------------------------------------------------ */
/*  Threat Keywords (5 categories)                                      */
/* ------------------------------------------------------------------ */

/**
 * Keywords for detecting fifth-generation warfare threat patterns.
 * Each category maps to an array of indicative keywords/phrases/domains.
 */
export const THREAT_KEYWORDS: Record<string, string[]> = {
  'adversarial-media': [
    'rt.com', 'sputnik', 'tass.com', 'xinhuanet', 'cgtn', 'pressTV', 'farsnews',
  ],
  'emotional-manipulation': [
    'must', 'urgent', 'shocking', 'you wont believe', 'they dont want you to know', 'wake up',
  ],
  'false-balance': [
    'both sides', 'all sides agree', 'controversial claim', 'debate rages', 'some say',
  ],
  'astroturfing': [
    'grassroots movement', 'people are saying', 'trending nationwide', 'ordinary citizens demand',
  ],
  'disinformation-vectors': [
    'deepfake', 'ai-generated', 'manipulated', 'fabricated', 'misleading',
  ],
};

/* ------------------------------------------------------------------ */
/*  Threat Assessment Types & Functions                                 */
/* ------------------------------------------------------------------ */

export interface ThreatAssessment {
  score: number;           // 0-100 (0 = clean, 100 = extreme threat)
  flags: string[];
  confidence: number;      // 0-100
  details: {
    category: string;
    matches: string[];
    severity: number;
  }[];
}

/**
 * Analyze content text for 5GW threat indicators.
 *
 * Searches text for each threat category's keywords and computes an
 * aggregate score (0-100). Each category contributes weight proportional
 * to the number of matches found. Confidence reflects how many distinct
 * threat categories were triggered.
 */
export async function analyzeContent(text: string, _source: string): Promise<ThreatAssessment> {
  const lowerText = text.toLowerCase();
  const details: ThreatAssessment['details'] = [];
  let totalWeightedSeverity = 0;
  let totalWeight = 0;
  const flags: string[] = [];
  let categoriesTriggered = 0;

  for (const [category, keywords] of Object.entries(THREAT_KEYWORDS)) {
    const matches: string[] = [];

    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matches.push(keyword);
      }
    }

    if (matches.length > 0) {
      categoriesTriggered++;
      // Severity: base 30 + 15 per match, capped at 100
      const severity = Math.min(30 + matches.length * 15, 100);
      totalWeightedSeverity += severity * matches.length;
      totalWeight += matches.length;

      details.push({ category, matches, severity });
      flags.push(`${category} (${matches.length} hit(s), severity ${severity})`);
    }
  }

  // Aggregate score: weighted average across all triggered categories
  const score = totalWeight > 0
    ? Math.min(Math.round(totalWeightedSeverity / totalWeight), 100)
    : 0;

  // Confidence: 30 base + 15 per triggered category, capped at 98
  const confidence = categoriesTriggered > 0
    ? Math.min(30 + categoriesTriggered * 15, 98)
    : 0;

  return { score, flags, confidence, details };
}

/**
 * Assess a source URL/name against threat keyword categories.
 * Returns whether the source is trusted and a warning if suspicious.
 */
export function assessSource(source: string): { trusted: boolean; category: string; warning: string | null } {
  const lowerSrc = source.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  for (const [category, keywords] of Object.entries(THREAT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerSrc.includes(keyword)) {
        return {
          trusted: false,
          category,
          warning: `Source matches '${keyword}' in category '${category}'`,
        };
      }
    }
  }

  return { trusted: true, category: 'unknown', warning: null };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildSummary(
  patterns: FiveGWPattern[],
  score: number,
  level: FiveGWThreatLevel,
  actorMatches: TrackedActorMatch[],
): string {
  const parts: string[] = [];

  if (patterns.length === 0) {
    return 'No fifth-generation warfare indicators detected.';
  }

  parts.push(`Threat score ${score}/100 (${level}): ${patterns.length} pattern(s) detected.`);

  const topPatterns = patterns
    .slice()
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 3);

  for (const p of topPatterns) {
    parts.push(`  - ${p.type.replace(/-/g, ' ')} (severity ${p.severity}): ${p.description}`);
  }

  if (actorMatches.length > 0) {
    const names = actorMatches.map(m => m.actorName).join(', ');
    parts.push(`  Matched tracked actors: ${names}`);
  }

  return parts.join('\n');
}
