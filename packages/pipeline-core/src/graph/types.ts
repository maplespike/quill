// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Graph data types for the MapleSpike pipeline
 */

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  properties: Record<string, unknown>;
  sourceRef: string;
}

export interface GraphConnection {
  node: GraphNode;
  edge: GraphEdge;
}

export interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  length: number;
}

export interface GraphBuilderOptions {
  maxDepth?: number;
  minWeight?: number;
}