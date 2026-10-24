// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { extractSchemas, schemaToMarkdown } from '@maplespike/pipeline-core/doc-generator';
import { PIPELINE_CORE_SRC } from '../pipeline-root.js';

export const definition: ToolDefinition = {
  name: 'qa_schema',
  description:
    'Extract and view TypeScript schema definitions for ingestion modules. ' +
    'Returns field names, types, required status, and descriptions. ' +
    'Use this to understand the data shape expected by a module.',
  inputSchema: {
    type: 'object',
    properties: {
      moduleName: {
        type: 'string',
        description: 'Module name filter (partial match, e.g., "committee" returns all committee schemas)',
      },
      format: {
        type: 'string',
        enum: ['markdown', 'json'],
        default: 'json',
        description: 'Output format',
      },
    },
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  try {
    const moduleFilter = String(args.moduleName ?? '').toLowerCase();
    const format = String(args.format ?? 'json');

    const schemas = extractSchemas(PIPELINE_CORE_SRC);

    const filtered = moduleFilter
      ? schemas.filter(s => s.file.toLowerCase().includes(moduleFilter) || s.name.toLowerCase().includes(moduleFilter))
      : schemas;

    if (filtered.length === 0) {
      return {
        content: {
          tool: 'qa_schema',
          status: 'empty',
          message: moduleFilter
            ? `No schemas found matching "${moduleFilter}"`
            : 'No schemas found',
        },
      };
    }

    if (format === 'markdown') {
      const md = filtered.map(schemaToMarkdown).join('\n');
      return {
        content: {
          tool: 'qa_schema',
          format: 'markdown',
          schemaCount: filtered.length,
          markdown: md,
        },
      };
    }

    return {
      content: {
        tool: 'qa_schema',
        format: 'json',
        schemaCount: filtered.length,
        schemas: filtered.map(s => ({
          name: s.name,
          file: s.file,
          fields: s.fields.map(f => ({
            name: f.name,
            type: f.type,
            required: !f.optional,
            description: f.description,
          })),
        })),
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'qa_schema',
        status: 'error',
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};
