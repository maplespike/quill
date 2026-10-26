// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface ExtractedField {
  name: string;
  type: string;
  optional: boolean;
  description: string;
}

export interface ExtractedSchema {
  name: string;
  file: string;
  fields: ExtractedField[];
}

const TYPE_PATTERN = /export\s+(interface|type)\s+(\w+)\s*(?:extends\s+[\w,\s]+\s*)?\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
const FIELD_PATTERN = /^\s*(readonly\s+)?(\w+)\??:\s*([^;/\n]+?)(?:\s*\/\*\*\s*(.*?)\s*\*\/\s*)?(?:\s*\/\/\s*(.*))?$/m;

const SCAN_DIRS = [
  'src/ingestion',
  'src/verification',
  'src/audit',
  'src/validation',
  'src/test-framework',
];

export function extractSchemas(rootDir: string): ExtractedSchema[] {
  const schemas: ExtractedSchema[] = [];

  for (const dir of SCAN_DIRS) {
    const fullDir = join(rootDir, dir);
    try {
      walkDir(fullDir, schemas, rootDir);
    } catch {
      // skip if dir doesn't exist
    }
  }

  return schemas;
}

function walkDir(dir: string, schemas: ExtractedSchema[], rootDir: string): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkDir(full, schemas, rootDir);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      const fileSchemas = extractSchemasFromFile(full, rootDir);
      schemas.push(...fileSchemas);
    }
  }
}

export function extractSchemasFromFile(filePath: string, rootDir: string): ExtractedSchema[] {
  const content = readFileSync(filePath, 'utf-8');
  const schemas: ExtractedSchema[] = [];
  let match: RegExpExecArray | null;

  const typeRe = new RegExp(TYPE_PATTERN.source, 'gs');
  while ((match = typeRe.exec(content)) !== null) {
    const name = match[2];
    const body = match[3];

    const fields: ExtractedField[] = [];
    const fieldRe = /^\s*(readonly\s+)?(\w+)\??:\s*([^;/\n]+?)\s*(?:\/\/\s*(.*))?$/gm;
    let fMatch: RegExpExecArray | null;
    while ((fMatch = fieldRe.exec(body)) !== null) {
      const fieldName = fMatch[2];
      const fieldType = fMatch[3].trim().replace(/\s+/g, ' ');
      const optional = body.substring(0, fMatch.index).includes(`${fieldName}?:`) || 
                        body.substring(fMatch.index - 2, fMatch.index).includes('?:');
      const comment = fMatch[4]?.trim() || '';

      fields.push({
        name: fieldName,
        type: fieldType,
        optional: fieldName.endsWith('?') || optional,
        description: comment,
      });
    }

    if (fields.length > 0) {
      schemas.push({
        name,
        file: relative(rootDir, filePath),
        fields,
      });
    }
  }

  return schemas;
}

export function schemaToMarkdown(schema: ExtractedSchema): string {
  const lines: string[] = [];
  lines.push(`### \`${schema.name}\``);
  lines.push('');
  lines.push(`**File:** \`${schema.file}\``);
  lines.push('');
  lines.push('| Field | Type | Required | Description |');
  lines.push('|-------|------|----------|-------------|');

  for (const field of schema.fields) {
    const required = field.optional ? 'No' : 'Yes';
    lines.push(`| \`${field.name}\` | \`${field.type}\` | ${required} | ${field.description} |`);
  }

  lines.push('');
  return lines.join('\n');
}
