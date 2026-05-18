// SPDX-License-Identifier: Apache-2.0
/**
 * MapleSpike — Zod Validation Schemas
 *
 * Centralized request body validation using Zod schemas.
 * All string schemas include .trim() to eliminate redundant manual trimming in handlers.
 */

import { z } from 'zod';

export type { z } from 'zod';

/* ------------------------------------------------------------------ */
/*  Auth & Registration                                                */
/* ------------------------------------------------------------------ */

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/* ------------------------------------------------------------------ */
/*  Billing                                                            */
/* ------------------------------------------------------------------ */

export const billingCheckoutSchema = z.object({
  planId: z.enum(['free', 'pro', 'business']),
  successUrl: z.string().trim().optional(),
  cancelUrl: z.string().trim().optional(),
});

export type BillingCheckoutInput = z.infer<typeof billingCheckoutSchema>;

/* ------------------------------------------------------------------ */
/*  AI Routes                                                          */
/* ------------------------------------------------------------------ */

export const aiAskSchema = z.object({
  query: z.string().trim().min(1).max(5000),
  source_filter: z.string().trim().max(200).optional(),
});

export type AiAskInput = z.infer<typeof aiAskSchema>;

export const aiAnalyzeSchema = z.object({
  text: z.string().trim().min(1).max(50000),
  mode: z.string().trim().max(100).optional(),
});

export type AiAnalyzeInput = z.infer<typeof aiAnalyzeSchema>;

/* ------------------------------------------------------------------ */
/*  Web3 Auth                                                          */
/* ------------------------------------------------------------------ */

export const web3ChallengeSchema = z.object({
  address: z.string().trim().min(1).max(200),
  chainId: z.union([z.number(), z.string()]).optional(),
});

export type Web3ChallengeInput = z.infer<typeof web3ChallengeSchema>;

export const web3LoginSchema = z.object({
  message: z.string().trim().min(1),
  signature: z.string().trim().min(1),
  address: z.string().trim().min(1).max(200),
});

export type Web3LoginInput = z.infer<typeof web3LoginSchema>;

/* ------------------------------------------------------------------ */
/*  API Keys                                                           */
/* ------------------------------------------------------------------ */

export const createKeySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
});

export type CreateKeyInput = z.infer<typeof createKeySchema>;

/* ------------------------------------------------------------------ */
/*  Contact Form                                                       */
/* ------------------------------------------------------------------ */

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
  subject: z.string().trim().min(1).max(500),
  message: z.string().trim().min(10).max(5000),
});

export type ContactInput = z.infer<typeof contactSchema>;

/* ------------------------------------------------------------------ */
/*  Validation Helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Parses a request body against a Zod schema.
 * Returns a success object with `data` on success, or a failure object
 * with formatted error messages on failure.
 */
export function validateBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
):
  | { success: true; data: z.infer<T> }
  | { success: false; error: string; issues: Array<{ field: string; message: string }> }
{
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true as const, data: result.data };
  }

  const issues = result.error.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join('.') : '_body';
    return { field, message: issue.message };
  });

  return {
    success: false as const,
    error: issues.map((i) => `${i.field}: ${i.message}`).join('; '),
    issues,
  };
}

import { buildError, jsonResponse } from './response.js';
import type { BuildContext } from './response.js';

export function validationError(
  message: string,
  ctx: BuildContext,
  issues: Array<{ field: string; message: string }>,
): Response {
  const base = buildError('VALIDATION_ERROR', message, ctx);
  return jsonResponse({
    ...base,
    error: { ...base.error!, details: issues },
  }, 400);
}
