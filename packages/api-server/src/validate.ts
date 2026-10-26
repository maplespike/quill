// SPDX-License-Identifier: AGPL-3.0-only

export interface FieldRule {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface ValidationSchema {
  [field: string]: FieldRule;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateBody(body: unknown, schema: ValidationSchema): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!body || typeof body !== 'object') {
    return [{ field: '_body', message: 'Request body must be a JSON object' }];
  }
  const obj = body as Record<string, unknown>;
  for (const [field, rule] of Object.entries(schema)) {
    const value = obj[field];
    if (rule.required && (value === undefined || value === null)) {
      errors.push({ field, message: `'${field}' is required` });
      continue;
    }
    if (value === undefined || value === null) continue;
    if (rule.type === 'array' && !Array.isArray(value)) {
      errors.push({ field, message: `'${field}' must be an array` });
      continue;
    }
    if (rule.type !== 'array' && typeof value !== rule.type) {
      errors.push({ field, message: `'${field}' must be a ${rule.type}` });
      continue;
    }
    if (rule.type === 'string') {
      const s = value as string;
      if (rule.minLength !== undefined && s.length < rule.minLength) {
        errors.push({ field, message: `'${field}' must be at least ${rule.minLength} characters` });
      }
      if (rule.maxLength !== undefined && s.length > rule.maxLength) {
        errors.push({ field, message: `'${field}' must be at most ${rule.maxLength} characters` });
      }
    }
    if (rule.type === 'number') {
      const n = value as number;
      if (rule.min !== undefined && n < rule.min) {
        errors.push({ field, message: `'${field}' must be at least ${rule.min}` });
      }
      if (rule.max !== undefined && n > rule.max) {
        errors.push({ field, message: `'${field}' must be at most ${rule.max}` });
      }
    }
  }
  return errors;
}
