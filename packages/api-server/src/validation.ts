// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Zod Validation Schemas
 *
 * Centralized request body validation using Zod schemas.
 * All string schemas include .trim() to eliminate redundant manual trimming in handlers.
 */

import { z } from 'zod';

export type { z } from 'zod';

/* ------------------------------------------------------------------ */
/*  Auth & Registration                                                */
/* ------------------------------------------------------------------ */

// Decision 0002: registration still accepts plaintext `email`
// for the verification-mail send, but downstream code MUST hash
// immediately and never store the plaintext.
export const registerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  // Trim first, then check the address. z.email().trim() checks before trim.
  email: z.string().trim().pipe(z.email()),
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
/*  Contact Form (Decision 0002 — RETIRED)                              */
/* ------------------------------------------------------------------ */
// The contact form used to ask for { name, email, subject, message }
// and email them to ops — direct PII retention. Now retired; the
// route returns 410 Gone. Schema kept exported as a deprecated
// vacuum so legacy imports type-check during the migration window.

/* ------------------------------------------------------------------ */
/*  Validation Helpers                                                 */
/* ------------------------------------------------------------------ */

/**
 * Parses a request body against a Zod schema.
 * Returns a success object with `data` on success, or a failure object
 * with formatted error messages on failure.
 */
export function validateBody<T extends z.ZodType>(
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
