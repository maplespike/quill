// SPDX-License-Identifier: AGPL-3.0-only
import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody } from '../validate.js';
import { listAnnotations, createAnnotation, updateAnnotation, deleteAnnotation, exportAnnotations } from '../services/annotationService.js';
import type { Annotation } from '../services/annotationService.js';

export const listAnnotationsHandler: RouteHandler = async (request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const url = new URL(request.url);
  const entityType = url.searchParams.get('entity_type');
  const entityId = url.searchParams.get('entity_id');
  if (!entityType || !entityId) return jsonResponse(buildError('VALIDATION_ERROR', 'entity_type and entity_id required', bc), 400);
  return jsonResponse(buildSuccess({ annotations: listAnnotations(entityType, entityId) }, bc));
};

export const createAnnotationHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  try {
    const body = await request.json() as Record<string, unknown>;
    const ann = createAnnotation({
      entityType: body.entity_type as string, entityId: body.entity_id as string,
      userId: ctx.tenant.id, annotationType: body.annotation_type as Annotation['annotationType'],
      content: body.content as string, metadata: body.metadata as Record<string, unknown> | undefined,
    });
    return jsonResponse(buildSuccess({ annotation: ann }, bc), 201);
  } catch { return jsonResponse(buildError('BAD_REQUEST', 'Invalid body', bc), 400); }
};

export const updateAnnotationHandler: RouteHandler = async (request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const id = params?.[0]; if (!id) return jsonResponse(buildError('MISSING_ID', 'Annotation ID required', bc), 400);
  try {
    const body = await request.json() as Record<string, unknown>;
    const updated = updateAnnotation(id, { content: body.content as string, annotationType: body.annotation_type as any });
    if (!updated) return jsonResponse(buildError('NOT_FOUND', 'Annotation not found', bc), 404);
    return jsonResponse(buildSuccess({ annotation: updated }, bc));
  } catch { return jsonResponse(buildError('BAD_REQUEST', 'Invalid body', bc), 400); }
};

export const deleteAnnotationHandler: RouteHandler = async (_request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const id = params?.[0]; if (!id) return jsonResponse(buildError('MISSING_ID', 'Annotation ID required', bc), 400);
  if (deleteAnnotation(id)) return jsonResponse(buildSuccess({ deleted: id }, bc));
  return jsonResponse(buildError('NOT_FOUND', 'Annotation not found', bc), 404);
};

export const exportAnnotationsHandler: RouteHandler = async (request, ctx, params) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  const url = new URL(request.url);
  const entityType = url.searchParams.get('entity_type');
  const entityId = url.searchParams.get('entity_id');
  const format = (url.searchParams.get('format') || 'markdown') as 'markdown' | 'html';
  if (!entityType || !entityId) return jsonResponse(buildError('VALIDATION_ERROR', 'entity_type and entity_id required', bc), 400);
  const result = exportAnnotations(entityType, entityId, format);
  return jsonResponse(buildSuccess({ content: result, format }, bc));
};
