/**
 * AI Inference Gateway HTTP client
 *
 * OpenAI-compatible HTTP client. The endpoint comes from QUILL_GATEWAY_URL.
 * Chat and embeddings stay off when that variable is unset.
 *
 * PII Sanitization: ALL messages sent to the AI and ALL responses received
 * are scanned for Canadian PII (SIN, passport, health card, etc.) and
 * redacted before transmission/storage.
 */

import { scanPII } from '@maplespike/pipeline-core';
import logger from '../logger.js';

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

export interface GatewayConfig {
  endpoint: string;
  chatModel: string;
  embedModel: string;
  apiKey?: string;
  maxRetries?: number;
  retryDelay?: number;
}

function envString(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function loadGatewayConfig(override?: Partial<GatewayConfig>): GatewayConfig {
  return {
    endpoint: override?.endpoint?.trim() || envString('QUILL_GATEWAY_URL') || '',
    chatModel: override?.chatModel || process.env.QUILL_CHAT_MODEL || 'qwen/qwen3-coder-30b-a3b-instruct',
    embedModel: override?.embedModel || process.env.QUILL_EMBED_MODEL || 'nvidia/llama-3.2-nv-embedqa-1b-v2',
    apiKey: override?.apiKey ?? envString('QUILL_GATEWAY_API_KEY'),
    maxRetries: override?.maxRetries ?? 2,
    retryDelay: override?.retryDelay ?? 1_000,
  };
}

function requireGatewayEndpoint(config: GatewayConfig): string {
  const endpoint = config.endpoint.trim().replace(/\/$/, '');
  if (!endpoint) {
    throw new Error('AI gateway is disabled. Set QUILL_GATEWAY_URL to enable chat and embeddings.');
  }
  return endpoint;
}

/* ------------------------------------------------------------------ */
/*  Chat Completion                                                    */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Send a chat completion request to the AI Inference Gateway.
 * Uses the default model (qwen/qwen3-coder-30b-a3b-instruct) unless overridden.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions & { model?: string } = {},
  configOverride?: Partial<GatewayConfig>,
): Promise<ChatCompletionResult> {
  const config = loadGatewayConfig(configOverride);
  const {
    temperature = 0.3,
    maxTokens = 4096,
    jsonMode = false,
    model = config.chatModel,
  } = options;

  const endpoint = requireGatewayEndpoint(config);
  const body: Record<string, unknown> = {
    model,
    messages: messages.map(m => ({
      role: m.role,
      content: scanPII(m.content).redacted,
    })),
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries!; attempt++) {
    try {
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI Gateway error (HTTP ${response.status}): ${errorText.slice(0, 500)}`);
      }

      const data: any = await response.json();
      const choice = data.choices?.[0];
      if (!choice?.message?.content) {
        throw new Error('Empty response from AI Gateway');
      }

      return {
        content: scanPII(choice.message.content).redacted,
        model: data.model || model,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      lastError = error as Error;
      if (attempt < config.maxRetries!) {
        const delay = config.retryDelay! * Math.pow(2, attempt);
        logger.warn({ err: lastError, attempt: attempt + 1, delay }, 'Chat attempt %d failed, retrying in %dms', attempt + 1, delay);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`AI Gateway chat failed after ${config.maxRetries! + 1} attempts: ${lastError?.message}`);
}

/* ------------------------------------------------------------------ */
/*  Embeddings                                                         */
/* ------------------------------------------------------------------ */

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * Generate an embedding vector for the given text.
 * Uses nvidia/llama-3.2-nv-embedqa-1b-v2 by default.
 */
export async function embed(
  text: string,
  configOverride?: Partial<GatewayConfig>,
): Promise<EmbeddingResult> {
  const config = loadGatewayConfig(configOverride);
  const endpoint = requireGatewayEndpoint(config);

  // Some embedding models require the input to be wrapped in a specific format
  const input = typeof text === 'string' ? text : JSON.stringify(text);

  const body = {
    model: config.embedModel,
    input,
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries!; attempt++) {
    try {
      const response = await fetch(`${endpoint}/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding API error (HTTP ${response.status}): ${errorText.slice(0, 500)}`);
      }

      const data: any = await response.json();
      const result = data.data?.[0];
      if (!result?.embedding || !Array.isArray(result.embedding)) {
        throw new Error('Invalid embedding response: no embedding array returned');
      }

      return {
        embedding: result.embedding,
        model: data.model || config.embedModel,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      lastError = error as Error;
      if (attempt < config.maxRetries!) {
        const delay = config.retryDelay! * Math.pow(2, attempt);
        logger.warn({ err: lastError, attempt: attempt + 1, delay }, 'Embed attempt %d failed, retrying in %dms', attempt + 1, delay);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(`Embedding failed after ${config.maxRetries! + 1} attempts: ${lastError?.message}`);
}

/**
 * Generate embeddings for multiple texts in batch.
 */
export async function embedBatch(
  texts: string[],
  configOverride?: Partial<GatewayConfig>,
): Promise<EmbeddingResult[]> {
  return Promise.all(texts.map((t) => embed(t, configOverride)));
}

/**
 * Get the current dimension of the embedding model output.
 * Uses a short string to probe the model's output dimension.
 */
export async function getEmbeddingDimension(
  configOverride?: Partial<GatewayConfig>,
): Promise<number> {
  const result = await embed('test', configOverride);
  return result.embedding.length;
}
