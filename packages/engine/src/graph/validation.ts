// SPDX-License-Identifier: AGPL-3.0-only
import { NodeSchema, EdgeSchema, GraphDataSchema } from './schemas.js';
import type { ValidatedNode, ValidatedEdge, ValidatedGraphData } from './schemas.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateGraphData(data: unknown): ValidationResult & { data?: ValidatedGraphData } {
  const result = GraphDataSchema.safeParse(data);
  if (result.success) return { valid: true, errors: [], data: result.data };
  return { valid: false, errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`) };
}

export function validateNode(node: unknown): ValidationResult & { data?: ValidatedNode } {
  const result = NodeSchema.safeParse(node);
  if (result.success) return { valid: true, errors: [], data: result.data };
  return { valid: false, errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`) };
}

export function validateEdge(edge: unknown): ValidationResult & { data?: ValidatedEdge } {
  const result = EdgeSchema.safeParse(edge);
  if (result.success) return { valid: true, errors: [], data: result.data };
  return { valid: false, errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`) };
}
