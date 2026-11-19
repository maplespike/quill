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

/** `export interface X {`, `export interface X extends Y {`, `export type X = {`. */
const TYPE_DECL_PATTERN = /export\s+(?:interface|type)\s+(\w+)\s*(?:<[^>]*>)?\s*(?:=\s*)?(?:extends\s+[^{]+)?\{/g;

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
    const candidate = scanDirCandidates(rootDir, dir).find((path) => isDirectory(path));
    if (candidate) walkDir(candidate, schemas, rootDir);
  }

  return schemas;
}

/**
 * Candidate absolute paths for one SCAN_DIRS entry.
 *
 * Callers disagree on the root they pass: quill-mcp's pipeline-root helper
 * resolves to `packages/pipeline-core/src`, while SCAN_DIRS are written with
 * the `src/` prefix. Checking both shapes keeps `qa_schema` and the
 * `quill://schemas` resource from silently scanning a non-existent
 * `src/src/...` path and returning an empty index.
 */
function scanDirCandidates(rootDir: string, dir: string): string[] {
  const trimmed = dir.replace(/^src\//, '');
  const candidates = [join(rootDir, dir), join(rootDir, trimmed)];
  return [...new Set(candidates)];
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
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
  const typeRe = new RegExp(TYPE_DECL_PATTERN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = typeRe.exec(content)) !== null) {
    const name = match[1];
    const openBrace = match.index + match[0].lastIndexOf('{');
    const closeBrace = findMatchingBrace(content, openBrace);
    if (closeBrace === -1) continue;

    const fields = parseFields(content.slice(openBrace + 1, closeBrace));
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

/** Index of the `}` matching the `{` at `openIndex`, or -1. Skips strings and comments. */
function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const char = source[i];
    if (char === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i);
      if (i === -1) return -1;
      continue;
    }
    if (char === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i + 2);
      if (i === -1) return -1;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      i = skipString(source, i);
      if (i === -1) return -1;
      continue;
    }
    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Index of the closing quote for the string starting at `start`, or -1. */
function skipString(source: string, start: number): number {
  const quote = source[start];
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === '\\') { i++; continue; }
    if (source[i] === quote) return i;
    if (quote !== '`' && source[i] === '\n') return i; // unterminated single-line string
  }
  return -1;
}

/**
 * Parse an interface/type body into fields.
 *
 * Members are separated by `;` at nesting depth 0, so nested object types and
 * multi-line unions stay attached to their field. `readonly` is dropped, `?`
 * marks optional, and a preceding JSDoc block becomes the description.
 */
function parseFields(body: string): ExtractedField[] {
  const members: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === '/' && body[i + 1] === '/') {
      const end = body.indexOf('\n', i);
      if (end === -1) break;
      // keep it: parseFields strips trailing line comments when normalising the type
      current += body.slice(i, end);
      i = end - 1;
      continue;
    }
    if (char === '/' && body[i + 1] === '*') {
      const end = body.indexOf('*/', i + 2);
      if (end === -1) break;
      current += body.slice(i, end + 2);
      i = end + 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      const end = skipString(body, i);
      const stop = end === -1 ? body.length - 1 : end;
      current += body.slice(i, stop + 1);
      i = stop;
      continue;
    }
    if (char === '{' || char === '[' || char === '(') depth++;
    else if (char === '}' || char === ']' || char === ')') depth = Math.max(0, depth - 1);

    if (char === ';' && depth === 0) {
      members.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) members.push(current);

  const fields: ExtractedField[] = [];
  let pendingDoc = '';

  for (const member of members) {
    let text = member.trim();
    if (!text) continue;

    const docMatch = text.match(/^\/\*\*([\s\S]*?)\*\/\s*/);
    if (docMatch) {
      pendingDoc = docMatch[1]
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/, '').trim())
        .filter(Boolean)
        .join(' ')
        .trim();
      text = text.slice(docMatch[0].length).trim();
    }

    // Drop trailing line/block comments from the member before parsing.
    text = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ').trim();
    if (!text) continue;

    const expr = text.match(/^(?:readonly\s+)?(\w+)\s*(\?)?\s*:\s*([\s\S]+)$/);
    if (!expr) {
      // Method signatures, index signatures and prose are not fields.
      pendingDoc = '';
      continue;
    }

    fields.push({
      name: expr[1],
      type: expr[3].trim().replace(/\s+/g, ' '),
      optional: Boolean(expr[2]),
      description: pendingDoc,
    });
    pendingDoc = '';
  }

  return fields;
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
