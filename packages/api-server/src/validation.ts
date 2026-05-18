/**
 * Request body validation using Zod schemas.
 * Every POST endpoint must validate its body against a schema.
 */
import { z } from 'zod';

export interface ValidatedResponse {
  valid: true;
  data: Record<string, unknown>;
}

export interface ValidationError {
  valid: false;
  error: string;
  status: 400;
}

export type ValidationResult = ValidatedResponse | ValidationError;

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns either parsed data or a structured error response.
 */
export async function validateBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: string; status: 400 }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { error: 'Request body must be valid JSON', status: 400 };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const firstError = result.error.issues[0];
    const message = firstError
      ? `${firstError.path.join('.')}: ${firstError.message}`
      : 'Invalid request body';
    return { error: message, status: 400 };
  }

  return { data: result.data };
}

/* ── Schema Definitions ────────────────────────────────────────── */

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
});

export const auditQuerySchema = z.object({
  operation: z.string().max(50).optional(),
  success: z.boolean().optional(),
  since: z.string().max(30).optional(),
  until: z.string().max(30).optional(),
  limit: z.number().int().min(1).max(1000).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const billingCheckoutSchema = z.object({
  planId: z.string().min(1).max(50).optional(),
  successUrl: z.string().url('Invalid success URL').optional().or(z.literal('')),
  cancelUrl: z.string().url('Invalid cancel URL').optional().or(z.literal('')),
});

export const aiAskSchema = z.object({
  query: z.string().min(1, 'Query is required').max(5000),
  sourceFilter: z.string().max(50).optional(),
});

export const aiAnalyzeSchema = z.object({
  text: z.string().min(1, 'Text is required').max(50000),
  mode: z.string().max(50).optional(),
});

export const createKeySchema = z.object({
  name: z.string().max(100).optional(),
});

export const authRefreshSchema = z.object({
  token: z.string().optional(),
});

export const authLogoutSchema = z.object({}).strict();

export const web3ChallengeSchema = z.object({
  address: z.string().min(1, 'Wallet address is required').max(200),
  chainId: z.number().int().optional(),
});

export const web3LoginSchema = z.object({
  message: z.string().min(1, 'Signed message is required').max(10000),
  signature: z.string().min(1, 'Signature is required').max(5000),
  address: z.string().min(1, 'Wallet address is required').max(200),
});

export const passkeyRegisterBeginSchema = z.object({
  userId: z.string().max(100).optional(),
  userName: z.string().max(100).optional(),
  deviceName: z.string().max(100).optional(),
});

export const passkeyRegisterCompleteSchema = z.object({
  registrationId: z.string().optional(),
  credential: z.any().optional(),
  deviceName: z.string().max(100).optional(),
});

export const passkeyLoginBeginSchema = z.object({
  userId: z.string().max(100).optional(),
});

export const passkeyLoginCompleteSchema = z.object({
  loginId: z.string().optional(),
  credential: z.any().optional(),
});
