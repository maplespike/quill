/**
 * MapleSpike — Passkey Auth Routes
 *
 * POST /v1/auth/passkey/register/begin — Get WebAuthn registration options
 * POST /v1/auth/passkey/register/complete — Verify registration
 * POST /v1/auth/passkey/login/begin — Get WebAuthn assertion options
 * POST /v1/auth/passkey/login/complete — Verify assertion and receive JWT
 * GET /v1/auth/passkey/credentials — List credentials for authenticated user
 * DELETE /v1/auth/passkey/credentials/:id — Delete a credential
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody } from '../validate.js';
import {
  beginRegistration,
  completeRegistration,
  beginLogin,
  completeLogin,
  listCredentials,
  deleteCredential,
} from '../auth/passkey.js';

export const passkeyRegisterBeginHandler: RouteHandler = async (request, ctx) => {
  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      userId: { type: 'string', maxLength: 200 },
      userName: { type: 'string', maxLength: 200 },
      deviceName: { type: 'string', maxLength: 200 },
    });
    if (errs.length > 0) {
      const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }
    const result = await beginRegistration({
      userId: (body.userId as string) || ctx.tenant.id,
      userName: (body.userName as string) || ctx.tenant.name || 'User',
      deviceName: body.deviceName as string | undefined,
    });

    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildSuccess(result, bc));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to begin registration';
    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildError('AUTH_ERROR', message, bc), 400);
  }
};

export const passkeyRegisterCompleteHandler: RouteHandler = async (request, ctx) => {
  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      registrationId: { type: 'string', required: true },
      credential: { type: 'object', required: true },
      deviceName: { type: 'string', maxLength: 200 },
    });
    if (errs.length > 0) {
      const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }
    const result = await completeRegistration({
      registrationId: body.registrationId as string,
      credential: body.credential as Record<string, unknown>,
      deviceName: body.deviceName as string | undefined,
    });

    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildSuccess(result, bc));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildError('AUTH_ERROR', message, bc), 400);
  }
};

export const passkeyLoginBeginHandler: RouteHandler = async (request, ctx) => {
  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      userId: { type: 'string', required: true, maxLength: 200 },
    });
    if (errs.length > 0) {
      const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }
    const result = beginLogin({
      userId: body.userId as string,
    });

    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildSuccess(result, bc));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to begin login';
    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildError('AUTH_ERROR', message, bc), 400);
  }
};

export const passkeyLoginCompleteHandler: RouteHandler = async (request, ctx) => {
  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      loginId: { type: 'string', required: true },
      credential: { type: 'object', required: true },
    });
    if (errs.length > 0) {
      const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }
    const result = await completeLogin({
      loginId: body.loginId as string,
      credential: body.credential as Record<string, unknown>,
    });

    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildSuccess(result, bc));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildError('AUTH_ERROR', message, bc), 401);
  }
};

export const passkeyListHandler: RouteHandler = async (_request, ctx) => {
  const result = listCredentials(ctx.tenant.id);

  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(buildSuccess({ credentials: result }, bc));
};

export const passkeyDeleteHandler: RouteHandler = async (_request, ctx, params) => {
  const deleted = deleteCredential(params.id);
  if (!deleted) {
    const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
    return jsonResponse(buildError('NOT_FOUND', 'Credential not found', bc), 404);
  }

  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(buildSuccess({ deleted: true }, bc));
};
