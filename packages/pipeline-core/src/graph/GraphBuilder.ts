// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Graph builder for constructing entity relationship graphs
 */
import { getRawDb } from "@maplespike/database";
import type { GraphNode, GraphEdge, GraphConnection, GraphPath, GraphBuilderOptions } from "./types.js";

export class GraphBuilder {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private adjacencyList: Map<string, Array<{ neighborId: string; edgeId: string }>> = new Map();
  private options: Required<GraphBuilderOptions>;

  constructor(options: GraphBuilderOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth ?? 10,
      minWeight: options.minWeight ?? 0.1,
    };
  }

  /**
   * Build graph from entity_links table
   */
  async buildFromEntities(): Promise<void> {
    const db = getRawDb();

    // Clear existing data
    this.nodes.clear();
    this.edges.clear();
    this.adjacencyList.clear();

    // Get all entity links
    const links = db
      .prepare(`
        SELECT
          el.*,
          e1.canonical_name as source_label,
          e2.canonical_name as target_label,
          e1.type as source_type,
          e2.type as target_type
        FROM entity_links el
        JOIN entities e1 ON el.source_entity_id = e1.id
        JOIN entities e2 ON el.target_entity_id = e2.id
      `)
      .all() as Array<{
        id: string;
        source_entity_id: string;
        target_entity_id: string;
        link_type: string;
        weight: number;
        source: string;
        metadata: string;
        created_at: string;
        source_label: string;
        target_label: string;
        source_type: string;
        target_type: string;
      }>;

    // Add nodes and edges
    for (const link of links) {
      // Add source node if not exists
      if (!this.nodes.has(link.source_entity_id)) {
        this.nodes.set(link.source_entity_id, {
          id: link.source_entity_id,
          type: link.source_type,
          label: link.source_label,
          properties: JSON.parse(link.metadata || '{}'),
        });
      }

      // Add target node if not exists
      if (!this.nodes.has(link.target_entity_id)) {
        this.nodes.set(link.target_entity_id, {
          id: link.target_entity_id,
          type: link.target_type,
          label: link.target_label,
          properties: JSON.parse(link.metadata || '{}'),
        });
      }

      // Add edge
      const edgeId = `edge-${link.id}`;
      const edge: GraphEdge = {
        id: edgeId,
        source: link.source_entity_id,
        target: link.target_entity_id,
        type: link.link_type,
        weight: link.weight,
        properties: JSON.parse(link.metadata || '{}'),
        sourceRef: link.source,
      };

      this.edges.set(edgeId, edge);

      // Update adjacency list
      if (!this.adjacencyList.has(link.source_entity_id)) {
        this.adjacencyList.set(link.source_entity_id, []);
      }
      this.adjacencyList.get(link.source_entity_id)!.push({
        neighborId: link.target_entity_id,
        edgeId: edgeId,
      });

      // Add reverse edge for undirected traversal
      if (!this.adjacencyList.has(link.target_entity_id)) {
        this.adjacencyList.set(link.target_entity_id, []);
      }
      this.adjacencyList.get(link.target_entity_id)!.push({
        neighborId: link.source_entity_id,
        edgeId: edgeId,
      });
    }
  }

  /**
   * Get connected nodes with edge metadata
   */
  getConnected(nodeId: string): GraphConnection[] {
    const connections: GraphConnection[] = [];
    const neighbors = this.adjacencyList.get(nodeId) || [];

    for (const { neighborId, edgeId } of neighbors) {
      const edge = this.edges.get(edgeId);
      const node = this.nodes.get(neighborId);

      if (edge && node) {
        connections.push({ node, edge });
      }
    }

    return connections;
  }

  /**
   * Find paths between nodes using BFS
   */
  findPaths(fromId: string, toId: string): GraphPath[] {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      return [];
    }

    const paths: GraphPath[] = [];
    const queue: Array<{
      currentId: string;
      pathNodes: string[];
      pathEdges: string[];
      depth: number
    }> = [{ currentId: fromId, pathNodes: [fromId], pathEdges: [], depth: 0 }];
    const visited: Set<string> = new Set();

    while (queue.length > 0) {
      const { currentId, pathNodes, pathEdges, depth } = queue.shift()!;

      if (depth > this.options.maxDepth) {
        continue;
      }

      if (currentId === toId && pathNodes.length > 1) {
        // Found a path, convert to GraphPath
        const nodes: GraphNode[] = pathNodes.map(id => this.nodes.get(id)!);
        const edges: GraphEdge[] = pathEdges.map(id => this.edges.get(id)!);
        paths.push({ nodes, edges, length: pathEdges.length });
        continue;
      }

      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const neighbors = this.adjacencyList.get(currentId) || [];
      for (const { neighborId, edgeId } of neighbors) {
        if (!visited.has(neighborId)) {
          queue.push({
            currentId: neighborId,
            pathNodes: [...pathNodes, neighborId],
            pathEdges: [...pathEdges, edgeId],
            depth: depth + 1,
          });
        }
      }
    }

    return paths;
  }

  /**
   * Get node by ID
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get edge by ID
   */
  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges
   */
  getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Clear graph data
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacencyList.clear();
  }
}