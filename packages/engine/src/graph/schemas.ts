import type { NodeType, EdgeType } from "../types/graph";
import { z } from "zod";

/**
 * Validation schemas for Graph Builder components.
 * Used to ensure typed correctness before graph construction.
 */

const nodeTypes = [
  "person", "organization", "contract",
  "lobbying_filing", "donation", "disclosure", "gac_project",
] as const;

const edgeTypes = [
  "awarded_to", "lobbied_by", "donated_by",
  "disclosed_by", "employed_at", "partnered_with",
  "related_to", "communicated_with", "filed_by", "implements",
] as const;

export const NodeSchema = z.object({
  id: z.string(),
  type: z.enum(nodeTypes),
  label: z.string(),
  properties: z.any(),
});

export const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.enum(edgeTypes),
  weight: z.number(),
  properties: z.any(),
  sourceRef: z.string(),
});

export const GraphSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
});

/**
 * Validate a single node against NodeSchema.
 * @param node - Node-like object to validate
 * @returns Parsed Node
 */
export const validateNode = (node: any) => {
  return NodeSchema.parse(node);
};

/**
 * Validate a single edge against EdgeSchema.
 * @param edge - Edge-like object to validate
 * @returns Parsed Edge
 */
export const validateEdge = (edge: any) => {
  return EdgeSchema.parse(edge);
};

/**
 * Validate a partial graph structure containing nodes and edges.
 * Returns validated arrays of nodes and edges.
 * @param graph - Partial graph with nodes/edges arrays
 * @returns Validated nodes and edges arrays
 */
export const validateGraph = (graph: any) => {
  const parsed = GraphSchema.parse(graph);
  return {
    nodes: parsed.nodes.map((n: any) => validateNode(n)),
    edges: parsed.edges.map((e: any) => validateEdge(e)),
  };
};