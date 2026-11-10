// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Web3 Auth Routes
 *
 * POST /v1/auth/web3/challenge — Get a message to sign with your wallet
 * POST /v1/auth/web3/login — Verify signed message and receive JWT
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { createChallenge, verifyAndLogin } from '../auth/web3.js';
import { validateBody } from '../validate.js';

export const web3ChallengeHandler: RouteHandler = async (request, ctx) => {
  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      address: { type: 'string', required: true, minLength: 10, maxLength: 200 },
      chainId: { type: 'number' },
    });
    if (errs.length > 0) {
      const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }
    const result = createChallenge({
      address: body.address as string,
      chainId: body.chainId as number | undefined,
    });

    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildSuccess(result, bc));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create challenge';
    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildError('AUTH_ERROR', message, bc), 400);
  }
};

export const web3LoginHandler: RouteHandler = async (request, ctx) => {
  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      message: { type: 'string', required: true, minLength: 1 },
      signature: { type: 'string', required: true, minLength: 1 },
      address: { type: 'string', required: true, minLength: 10, maxLength: 200 },
    });
    if (errs.length > 0) {
      const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }
    const result = await verifyAndLogin({
      message: body.message as string,
      signature: body.signature as string,
      address: body.address as string,
    });

    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildSuccess(result, bc));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildError('AUTH_ERROR', message, bc), 401);
  }
};
