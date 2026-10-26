/**
 * Validation schemas for entity graph data using Zod.
 */
import { z } from 'zod';

export const NodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['person', 'organization', 'contract', 'lobbying_filing', 'disclosure', 'donation', 'project']),
  label: z.string().min(1),
  // .default() returns this value when the input is undefined. The value is
  // already the output type, so .prefault() is not required.
  properties: z.record(z.string(), z.unknown()).default({}),
});

export const EdgeSchema = z.object({
  id: z.string().min(1),
  source_node: z.string().min(1),
  target_node: z.string().min(1),
  type: z.enum(['employment', 'lobbying', 'donation', 'contract', 'board', 'education', 'other']),
  weight: z.number().min(0).max(1).default(0.5),
  source_ref: z.string().default(''),
});

export const GraphDataSchema = z.object({
  nodes: z.array(NodeSchema).min(1),
  edges: z.array(EdgeSchema),
});

export type ValidatedNode = z.infer<typeof NodeSchema>;
export type ValidatedEdge = z.infer<typeof EdgeSchema>;
export type ValidatedGraphData = z.infer<typeof GraphDataSchema>;
