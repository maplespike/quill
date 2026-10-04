/**
 * Curation Scoring — Quill
 *
 * Types, scoring logic, and threshold evaluation for AI-curated articles.
 *
 * Origin: cloudflare/worker/src/index.ts (lines 84-95, 956-1063, 1105-1127)
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface CurationResult {
  canadianRelevance: number;
  accountabilityValue: number;
  missionAlignment: number;
  sourceQuality: number;
  urgency: number;
  totalScore: number;
  reason: string;
  shouldReject: boolean;
  isBreaking: boolean;
  category: string;
}

export interface ArticleInsights {
  summary: string;
  keyPoints: string[];
  stakeholders: string[];
  implications: string[];
  whatNext: string[];
  readingTime: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface BiasAnalysis {
  overallBias: 'left' | 'center-left' | 'center' | 'center-right' | 'right';
  biasScore: number;
  confidence: number;
  framing: {
    language: string[];
    tone: string;
    perspective: string;
  };
  whatMissing: string[];
  contextGaps: string[];
  alternativePerspectives: string[];
}

export interface CurationThresholds {
  canadianRelevance: number;
  accountabilityValue: number;
  missionAlignment: number;
}

/** Default thresholds matching FG production values. */
export const DEFAULT_THRESHOLDS: CurationThresholds = {
  canadianRelevance: 70,
  accountabilityValue: 60,
  missionAlignment: 60,
};

/* ------------------------------------------------------------------ */
/*  Scoring                                                            */
/* ------------------------------------------------------------------ */

/**
 * Calculate weighted total score from curation dimensions.
 * Currently an even average — can be tuned per deployment.
 */
export function calculateTrustScore(result: Pick<CurationResult, 'canadianRelevance' | 'accountabilityValue' | 'missionAlignment' | 'sourceQuality' | 'urgency'>): number {
  const { canadianRelevance, accountabilityValue, missionAlignment, sourceQuality, urgency } = result;
  return Math.round(
    (canadianRelevance * 0.25 +
      accountabilityValue * 0.25 +
      missionAlignment * 0.2 +
      sourceQuality * 0.15 +
      urgency * 0.15),
  );
}

/**
 * Evaluate whether a curation result meets acceptance thresholds.
 * Returns true if any dimension falls below its threshold.
 */
export function evaluateThresholds(
  result: Pick<CurationResult, 'canadianRelevance' | 'accountabilityValue' | 'missionAlignment'>,
  thresholds: CurationThresholds = DEFAULT_THRESHOLDS,
): boolean {
  return (
    result.canadianRelevance < thresholds.canadianRelevance ||
    result.accountabilityValue < thresholds.accountabilityValue ||
    result.missionAlignment < thresholds.missionAlignment
  );
}

/* ------------------------------------------------------------------ */
/*  Default / Fallback Results                                         */
/* ------------------------------------------------------------------ */

export function defaultCurationResult(category: string): CurationResult {
  return {
    canadianRelevance: 0,
    accountabilityValue: 0,
    missionAlignment: 0,
    sourceQuality: 50,
    urgency: 0,
    totalScore: 0,
    reason: 'AI analysis failed',
    shouldReject: true,
    isBreaking: false,
    category,
  };
}

export function defaultInsights(summary: string, title: string): ArticleInsights {
  return {
    summary: summary || 'No summary available',
    keyPoints: [title],
    stakeholders: [],
    implications: [],
    whatNext: [],
    readingTime: 3,
    complexity: 'medium',
  };
}

export function defaultBiasAnalysis(): BiasAnalysis {
  return {
    overallBias: 'center',
    biasScore: 10,
    confidence: 50,
    framing: {
      language: [],
      tone: 'neutral',
      perspective: 'unknown',
    },
    whatMissing: [],
    contextGaps: [],
    alternativePerspectives: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Trust Source Scores                                                 */
/* ------------------------------------------------------------------ */

/**
 * Pre-configured trust scores for known sources (0 = untrusted, 100 = fully trusted).
 */
export const TTRUST_SOURCE_SCORES: Record<string, number> = {
  // Canadian government & official
  'canada.ca': 95,
  'statcan.gc.ca': 95,
  'pm.gc.ca': 90,
  // Major Canadian media
  'cbc.ca': 80,
  'globeandmail.com': 80,
  'thestar.com': 75,
  'nationalpost.com': 70,
  'lapresse.ca': 80,
  // International wire services
  'reuters.com': 85,
  'apnews.com': 85,
  'bbc.com': 75,
  'bbc.co.uk': 75,
  // Adversarial / low-trust sources
  'rt.com': 5,
  'sputniknews.com': 5,
  'tass.com': 10,
  'xinhuanet.com': 15,
  'cgtn.com': 15,
  'farsnews.ir': 5,
  'presstv.ir': 5,
};

/**
 * Compute a trust score for a given source URL/name (0-100).
 * Looks up the domain in TTRUST_SOURCE_SCORES; returns a neutral score of 50
 * if the source is not found.
 */
export function computeTrustScore(source: string): number {
  const domain = source.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  for (const [key, score] of Object.entries(TTRUST_SOURCE_SCORES)) {
    if (domain.includes(key)) {
      return score;
    }
  }
  return 50;
}

/**
 * Compute a composite trust score combining source trustworthiness and
 * content-level 5GW threat analysis.
 *
 * Source score (60% weight) comes from computeTrustScore.
 * Content score (40% weight) comes from inverting the 5GW threat score
 * (100 - threatScore) — so clean content scores high.
 *
 * Level classification:
 *   <40  = low trust
 *   40-69 = medium trust
 *   70+  = high trust
 */
export async function compositeTrustScore(
  source: string,
  content: string,
): Promise<{ sourceScore: number; contentScore: number; composite: number; level: 'low' | 'medium' | 'high' }> {
  const sourceScore = computeTrustScore(source);

  // Import and use 5GW content analysis (inverted)
  const { analyzeContent } = await import('../verification/fifth-gen-warfare.js');
  const threatAssessment = await analyzeContent(content, source);
  const contentScore = 100 - threatAssessment.score; // invert so clean = high

  const composite = Math.round(sourceScore * 0.6 + contentScore * 0.4);
  let level: 'low' | 'medium' | 'high';
  if (composite < 40) {
    level = 'low';
  } else if (composite < 70) {
    level = 'medium';
  } else {
    level = 'high';
  }

  return { sourceScore, contentScore, composite, level };
}
