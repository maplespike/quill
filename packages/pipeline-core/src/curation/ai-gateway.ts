// SPDX-License-Identifier: AGPL-3.0-only
/**
 * AI Gateway Client — Quill
 *
 * Generic fetch-based client for OpenAI-compatible chat completion APIs.
 * Supports rate-limit retry, JSON mode, and safe defaults on failure.
 *
 * Origin: cloudflare/worker/src/index.ts (lines 958-1063, 1163-1211, 1213-1265)
 */

import { CURATION_PROMPT, INSIGHTS_PROMPT, BIAS_ANALYSIS_PROMPT } from './prompts.js';
import type { CurationResult, ArticleInsights, BiasAnalysis, CurationThresholds } from './scoring.js';
import { evaluateThresholds, defaultCurationResult, defaultInsights, defaultBiasAnalysis, calculateTrustScore } from './scoring.js';
import type { ProviderRouter } from './provider-router.js';

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

export interface AIGatewayConfig {
  endpoint: string;
  model: string;
  apiKey?: string;
  retryDelay?: number;
  maxRetries?: number;
}

const USER_AGENT = 'MapleSpike/0.2 (+https://maplespike.lan)';

const DEFAULT_CONFIG: AIGatewayConfig = {
  endpoint: 'http://127.0.0.1:8080/v1',
  model: 'qwen3.5-27b',
  retryDelay: 60_000,
  maxRetries: 1,
};

/* ------------------------------------------------------------------ */
/*  Chat Completion Helper                                             */
/* ------------------------------------------------------------------ */

interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

async function chatComplete(
  config: AIGatewayConfig,
  prompt: string,
  options: ChatCompletionOptions = {},
): Promise<string> {
  const { temperature = 0.3, maxTokens = 1024, jsonMode = true } = options;
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

  async function attempt(): Promise<string> {
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

  return attempt();
}

/* ------------------------------------------------------------------ */
/*  Curation Service                                                   */
/* ------------------------------------------------------------------ */

export class CurationService {
  private config: AIGatewayConfig;
  private thresholds: CurationThresholds;
  private router: ProviderRouter | null;

  constructor(
    config: Partial<AIGatewayConfig> = {},
    thresholds?: CurationThresholds,
    router?: ProviderRouter,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.thresholds = thresholds || { canadianRelevance: 70, accountabilityValue: 60, missionAlignment: 60 };
    this.router = router || null;
  }

  /**
   * Send a chat completion request — uses ProviderRouter if available,
   * otherwise falls back to the original direct endpoint call.
   */
  private async sendChatRequest(
    prompt: string,
    options: ChatCompletionOptions = {},
  ): Promise<string> {
    if (this.router) {
      return this.router.chatComplete(prompt, options);
    }

    // Fallback: original direct call
    return chatComplete(this.config, prompt, options);
  }

  /**
   * Curate a single article: AI analysis → threshold check → trust score.
   * Returns a CurationResult with shouldReject set appropriately.
   */
  async curate(article: { title: string; summary: string; source: string; category: string }): Promise<CurationResult> {
    const prompt = `${CURATION_PROMPT}

Title: ${article.title}
Summary: ${article.summary}
Source: ${article.source}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      try {
        const content = await this.sendChatRequest(prompt, { temperature: 0.3, maxTokens: 1024 });
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in AI response');

        const parsed = JSON.parse(jsonMatch[0]) as CurationResult;

        // Fill computed fields
        parsed.totalScore = parsed.totalScore || calculateTrustScore(parsed);
        parsed.shouldReject = parsed.shouldReject ?? evaluateThresholds(parsed, this.thresholds);
        parsed.category = parsed.category || article.category;

        return parsed;
      } catch (error) {
        lastError = error as Error;
        console.error(`Curation attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < this.config.maxRetries! && lastError.message.includes('429')) {
          const delay = this.config.retryDelay! * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    console.error('Curation failed after all retries:', lastError?.message);
    return defaultCurationResult(article.category);
  }

  /**
   * Generate insights for an article (on-demand, not part of batch curation).
   */
  async generateInsights(article: { title: string; summary: string; source: string; content?: string }): Promise<ArticleInsights> {
    const prompt = `${INSIGHTS_PROMPT}

Title: ${article.title}
Summary: ${article.summary}
Source: ${article.source}
Content: ${(article.content || '').slice(0, 3000)}`;

    try {
      const content = await this.sendChatRequest(prompt, { temperature: 0.4, maxTokens: 1500 });
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in AI response');
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Insights generation failed:', (error as Error).message);
      return defaultInsights(article.summary, article.title);
    }
  }

  /**
   * Generate bias/framing analysis for an article.
   */
  async generateBiasAnalysis(article: { title: string; summary: string; source: string; content?: string }): Promise<BiasAnalysis> {
    const prompt = `${BIAS_ANALYSIS_PROMPT}

Title: ${article.title}
Summary: ${article.summary}
Source: ${article.source}
Content: ${(article.content || '').slice(0, 3000)}`;

    try {
      const content = await this.sendChatRequest(prompt, { temperature: 0.3, maxTokens: 1200 });
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in AI response');
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Bias analysis failed:', (error as Error).message);
      return defaultBiasAnalysis();
    }
  }
}

export { evaluateThresholds, calculateTrustScore, defaultCurationResult, defaultInsights, defaultBiasAnalysis } from './scoring.js';
export { CURATION_PROMPT, INSIGHTS_PROMPT, BIAS_ANALYSIS_PROMPT } from './prompts.js';
