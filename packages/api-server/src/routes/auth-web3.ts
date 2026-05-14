/**
 * MapleSpike — Web3 Auth Routes
 *
 * POST /v1/auth/web3/challenge — Get a message to sign with your wallet
 * POST /v1/auth/web3/login — Verify signed message and receive JWT
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { createChallenge, verifyAndLogin } from '../auth/web3.js';

export const web3ChallengeHandler: RouteHandler = async (request, ctx) => {
  try {
    const body = await request.json() as any;
    const result = createChallenge({
      address: body.address,
      chainId: body.chainId,
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
    const body = await request.json() as any;
    const result = await verifyAndLogin({
      message: body.message,
      signature: body.signature,
      address: body.address,
    });

    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildSuccess(result, bc));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildError('AUTH_ERROR', message, bc), 401);
  }
};
