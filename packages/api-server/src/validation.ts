import { z } from 'zod';
import type { BuildContext } from './response.js';
import { buildError, jsonResponse } from './response.js';

export const registerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
});

export const auditQuerySchema = z.object({
  operation: z.string().optional(),
  success: z.boolean().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.number().int().max(1000).optional(),
  offset: z.number().int().optional(),
});

export const billingCheckoutSchema = z.object({
  planId: z.enum(['free', 'pro', 'business']),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
});

export const aiAskSchema = z.object({
  query: z.string().min(1),
  source_filter: z.string().optional(),
});

export const aiAnalyzeSchema = z.object({
  text: z.string().min(1),
  mode: z.string().optional(),
});

export const web3ChallengeSchema = z.object({
  address: z.string().min(1).max(200),
  chainId: z.number().int().optional(),
});

export const web3LoginSchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
  address: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  subject: z.string().min(1).max(500),
  message: z.string().min(10).max(5000),
});

export const logoutSchema = z.object({}).strict();

type ValidResult<T> = { success: true; data: T };
type InvalidResult = { success: false; error: string; issues: z.ZodIssue[] };

export function validateBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
): ValidResult<z.infer<T>> | InvalidResult {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const error = result.error.issues
    .map(i => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return { success: false, error, issues: result.error.issues };
}

export function validationError(
  message: string,
  ctx: BuildContext,
  issues: z.ZodIssue[],
): Response {
  const base = buildError('VALIDATION_ERROR', message, ctx);
  return jsonResponse({
    ...base,
    error: { ...base.error!, details: issues },
  }, 400);
}
