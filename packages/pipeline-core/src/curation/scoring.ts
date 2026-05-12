/**
 * Curation Scoring — Frostbite Data Pipeline
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
