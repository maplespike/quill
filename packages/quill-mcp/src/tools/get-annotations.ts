// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { callApi, ServerUnavailableError } from './api-client.js';

export const definition: ToolDefinition = {
  name: 'get_annotations',
  description:
    'Retrieve annotations for a specific entity from the journalism annotation system. ' +
    'Returns all notes, flags, overrides, and context annotations for the given entity type and ID. ' +
    'Optionally filter by user ID to get annotations from a specific user. ' +
    'When an API server is configured (QUILL_API_URL), queries it for persistent storage; ' +
    'otherwise uses an in-memory store (annotations created through the API server will not be visible).',
  inputSchema: {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        description: 'The type of the entity (e.g., "committee", "bill", "politician")',
      },
      entity_id: {
        type: 'string',
        description: 'The unique identifier of the entity',
      },
      userId: {
        type: 'string',
        description: 'Optional: Filter annotations by user ID',
      },
    },
    required: ['entity_type', 'entity_id'],
  },
};

interface AnnotationRecord {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  annotationType: 'note' | 'override' | 'flag' | 'context';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ── In-memory fallback store ──

const store = new Map<string, AnnotationRecord>();

function addAnnotation(record: AnnotationRecord): void {
  store.set(record.id, record);
}

function findAnnotations(entityType: string, entityId: string, userId?: string): AnnotationRecord[] {
  const all = Array.from(store.values());
  let filtered = all.filter(a => a.entityType === entityType && a.entityId === entityId);
  if (userId) {
    filtered = filtered.filter(a => a.userId === userId);
  }
  return filtered;
}

// Export for testing
export function _resetStore(): void { store.clear(); }
export function _seedStore(records: AnnotationRecord[]): void { records.forEach(r => store.set(r.id, r)); }

// ── Handler ──

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  try {
    const { entity_type, entity_id, userId } = args;

    if (typeof entity_type !== 'string' || typeof entity_id !== 'string') {
      return {
        content: { error: 'entity_type and entity_id must be strings' },
        isError: true,
      };
    }

    if (userId !== undefined && typeof userId !== 'string') {
      return {
        content: { error: 'userId must be a string if provided' },
        isError: true,
      };
    }

    // Try API server first
    if (process.env.QUILL_API_URL) {
      try {
        const params: Record<string, string | number> = { entity_type, entity_id };
        if (userId) params.userId = userId;
        const data = await callApi<{ annotations: AnnotationRecord[]; count: number }>('/annotations', params);
        return {
          content: {
            annotations: data.annotations ?? [],
            count: data.count ?? data.annotations.length,
          },
        };
      } catch (err) {
        if (err instanceof ServerUnavailableError) {
          // Fall through to in-memory store
        } else {
          return {
            content: { error: (err as Error).message },
            isError: true,
          };
        }
      }
    }

    // Fallback: in-memory store
    const filtered = findAnnotations(entity_type, entity_id, userId);

    if (filtered.length === 0) {
      return {
        content: {
          annotations: [],
          count: 0,
          message: 'No annotations found for the specified criteria',
        },
      };
    }

    return {
      content: {
        annotations: filtered.map(ann => ({
          id: ann.id,
          entityType: ann.entityType,
          entityId: ann.entityId,
          userId: ann.userId,
          type: ann.annotationType,
          content: ann.content,
          metadata: ann.metadata,
          createdAt: ann.createdAt,
          updatedAt: ann.updatedAt,
        })),
        count: filtered.length,
      },
    };
  } catch (error) {
    return {
      content: { error: (error as Error).message },
      isError: true,
    };
  }
};
