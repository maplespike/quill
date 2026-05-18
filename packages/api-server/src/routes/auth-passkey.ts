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
import { validateBody, passkeyRegisterBeginSchema, passkeyRegisterCompleteSchema, passkeyLoginBeginSchema, passkeyLoginCompleteSchema } from '../validation.js';
import {
  beginRegistration,
  completeRegistration,
  beginLogin,
  completeLogin,
  listCredentials,
  deleteCredential,
} from '../auth/passkey.js';

export const passkeyRegisterBeginHandler: RouteHandler = async (request, ctx) => {
  const parsed = await validateBody(request, passkeyRegisterBeginSchema);
  if ('error' in parsed) {
    return jsonResponse(buildError('VALIDATION_ERROR', parsed.error, ctx), parsed.status);
  }
  const body = parsed.data;

  try {
    const result = await beginRegistration({
      userId: body.userId || ctx.tenant.id,
      userName: body.userName || ctx.tenant.name || 'User',
      deviceName: body.deviceName,
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
  const parsed = await validateBody(request, passkeyRegisterCompleteSchema);
  if ('error' in parsed) {
    return jsonResponse(buildError('VALIDATION_ERROR', parsed.error, ctx), parsed.status);
  }
  const body = parsed.data;

  try {
    const result = await completeRegistration({
      registrationId: body.registrationId as string,
      credential: body.credential,
      deviceName: body.deviceName,
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
  const parsed = await validateBody(request, passkeyLoginBeginSchema);
  if ('error' in parsed) {
    return jsonResponse(buildError('VALIDATION_ERROR', parsed.error, ctx), parsed.status);
  }
  const body = parsed.data;

  try {
    const result = beginLogin({
      userId: body.userId,
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
  const parsed = await validateBody(request, passkeyLoginCompleteSchema);
  if ('error' in parsed) {
    return jsonResponse(buildError('VALIDATION_ERROR', parsed.error, ctx), parsed.status);
  }
  const body = parsed.data;

  try {
    const result = await completeLogin({
      loginId: body.loginId as string,
      credential: body.credential,
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
