import type { ToolDefinition, ToolHandler } from './types.js';

export const definition: ToolDefinition = {
  name: 'get_annotations',
  description:
    'Retrieve annotations for a specific entity from the journalism annotation system. ' +
    'Returns all notes, flags, overrides, and context annotations for the given entity type and ID. ' +
    'Optionally filter by user ID to get annotations from a specific user.',
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

const store = new Map<string, {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  annotationType: 'note' | 'override' | 'flag' | 'context';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}>();

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  try {
    const { entity_type, entity_id, userId } = args;

    if (typeof entity_type !== 'string' || typeof entity_id !== 'string') {
      return {
        content: {
          error: 'entity_type and entity_id must be strings',
        },
        isError: true,
      };
    }

    if (userId !== undefined && typeof userId !== 'string') {
      return {
        content: {
          error: 'userId must be a string if provided',
        },
        isError: true,
      };
    }

    const allAnnotations = Array.from(store.values());
    let filtered = allAnnotations.filter(
      a => a.entityType === entity_type && a.entityId === entity_id
    );

    if (userId) {
      filtered = filtered.filter(a => a.userId === userId);
    }

    if (filtered.length === 0) {
      return {
        content: {
          annotations: [],
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
      content: {
        error: (error as Error).message,
      },
      isError: true,
    };
  }
};