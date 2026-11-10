// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Graph Builder
 *
 * Builds the full entity connection graph from parsed data.
 * Uses adjacency list representation for fast traversal.
 */

import type { AliasManager } from "../entity/aliases";
import { EntityResolver } from "../entity/resolver";
import type { Contract } from "../types/contract";
import type { Disclosure } from "../types/disclosure";
import type { Donation } from "../types/donation";
import type { GACProject } from "../types/gac";
import type {
  Edge,
  EdgeType,
  GraphData,
  IntelligenceThread,
  Node,
  NodeType,
} from "../types/graph";
import type { LobbyingFiling } from "../types/lobbying";
import type { Organization } from "../types/organization";
import type { Person } from "../types/person";

let edgeCounter = 0;

function nextEdgeId(): string {
  return `edge-${++edgeCounter}`;
}

function resetEdgeCounter(): void {
  edgeCounter = 0;
}

/** Build a node ID from type and a key string */
export function makeNodeId(type: NodeType, key: string): string {
  return `${type}:${key}`;
}

export class GraphBuilder {
  private nodes: Map<string, Node> = new Map();
  private edges: Map<string, Edge> = new Map();
  private adjacency: Map<string, Set<string>> = new Map();
  private threads: IntelligenceThread[] = [];
  private resolver: EntityResolver;

  constructor(aliasManager: AliasManager) {
    this.resolver = new EntityResolver(aliasManager);
  }

  /** Add a node to the graph */
  addNode(node: Node): void {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, new Set());
    }
  }

  /** Add an edge to the graph */
  addEdge(edge: Edge): void {
    this.edges.set(edge.id, edge);
    // Adjacency is bidirectional for traversal
    if (!this.adjacency.has(edge.source)) {
      this.adjacency.set(edge.source, new Set());
    }
    if (!this.adjacency.has(edge.target)) {
      this.adjacency.set(edge.target, new Set());
    }
    this.adjacency.get(edge.source)!.add(edge.target);
    this.adjacency.get(edge.target)!.add(edge.source);
  }

  /** Get a node by ID */
  getNode(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  /** Get all edges connected to a node */
  getEdges(nodeId: string): Edge[] {
    const result: Edge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.source === nodeId || edge.target === nodeId) {
        result.push(edge);
      }
    }
    return result;
  }

  /** Get all neighbor nodes of a given node */
  getNeighbors(nodeId: string): Node[] {
    const neighborIds = this.adjacency.get(nodeId);
    if (!neighborIds) return [];
    const result: Node[] = [];
    for (const nid of neighborIds) {
      const node = this.nodes.get(nid);
      if (node) result.push(node);
    }
    return result;
  }

  /**
   * Find all paths between two nodes up to a maximum depth using BFS.
   * Returns arrays of edges forming each path.
   */
  getPaths(fromId: string, toId: string, maxDepth: number): Edge[][] {
    if (fromId === toId) return [];

    const paths: Edge[][] = [];
    // BFS state: [current node, path of edges so far, visited set]
    const queue: Array<[string, Edge[], Set<string>]> = [
      [fromId, [], new Set([fromId])],
    ];

    while (queue.length > 0) {
      const [current, path, visited] = queue.shift()!;
      if (path.length >= maxDepth) continue;

      const neighborIds = this.adjacency.get(current);
      if (!neighborIds) continue;

      for (const neighborId of neighborIds) {
        if (visited.has(neighborId)) continue;

        // Find the edge(s) between current and neighbor
        const connectingEdges = this.getEdgesBetween(current, neighborId);

        for (const edge of connectingEdges) {
          const newPath = [...path, edge];
          if (neighborId === toId) {
            paths.push(newPath);
          } else {
            const newVisited = new Set(visited);
            newVisited.add(neighborId);
            queue.push([neighborId, newPath, newVisited]);
          }
        }
      }
    }

    return paths;
  }

  /** Helper: get edges between two specific nodes */
  private getEdgesBetween(nodeA: string, nodeB: string): Edge[] {
    const result: Edge[] = [];
    for (const edge of this.edges.values()) {
      if (
        (edge.source === nodeA && edge.target === nodeB) ||
        (edge.source === nodeB && edge.target === nodeA)
      ) {
        result.push(edge);
      }
    }
    return result;
  }

  /**
   * Build the full connection graph from all parsed data.
   * Creates nodes for each entity and edges for each relationship.
   */
  buildGraph(
    persons: Person[],
    organizations: Organization[],
    contracts: Contract[],
    filings: LobbyingFiling[],
    donations: Donation[],
    disclosures: Disclosure[],
    gacProjects: GACProject[],
  ): GraphData {
    resetEdgeCounter();

    // Add person nodes
    for (const person of persons) {
      this.addNode({
        id: person.id,
        type: "person",
        label: person.names[0] ?? person.id,
        properties: {
          names: person.names,
          roles: person.roles,
          relationships: person.relationships,
        },
      });
    }

    // Add organization nodes
    for (const org of organizations) {
      this.addNode({
        id: org.id,
        type: "organization",
        label: org.names[0] ?? org.id,
        properties: {
          names: org.names,
          type: org.type,
          industry: org.industry,
          parentOrganizationId: org.parentOrganizationId,
        },
      });
    }

    // Add contract nodes + edges
    for (const contract of contracts) {
      this.addNode({
        id: contract.id,
        type: "contract",
        label: contract.title,
        properties: {
          contractNumber: contract.contractNumber,
          department: contract.department,
          value: contract.value,
          isSoleSource: contract.isSoleSource,
          vendorName: contract.vendorName,
          status: contract.status,
        },
      });

      // Edge: contract → vendor org
      const vendorOrg = this.findOrgByName(organizations, contract.vendorName);
      if (vendorOrg) {
        this.addEdge({
          id: nextEdgeId(),
          source: contract.id,
          target: vendorOrg.id,
          type: "awarded_to",
          weight: contract.value,
          properties: {},
          sourceRef: contract.source,
        });
      }

      // Edge: department → contract (department as synthetic org node)
      const deptId = makeNodeId("organization", contract.department);
      if (!this.nodes.has(deptId)) {
        this.addNode({
          id: deptId,
          type: "organization",
          label: contract.department,
          properties: { type: "government_agency", synthetic: true },
        });
      }
      this.addEdge({
        id: nextEdgeId(),
        source: deptId,
        target: contract.id,
        type: "awarded_to",
        weight: contract.value,
        properties: {},
        sourceRef: contract.source,
      });
    }

    // Add lobbying filing nodes + edges
    for (const filing of filings) {
      this.addNode({
        id: filing.id,
        type: "lobbying_filing",
        label: `${filing.clientName} — ${filing.subjectMatter}`,
        properties: {
          filingNumber: filing.filingNumber,
          clientName: filing.clientName,
          institution: filing.institution,
          subjectMatter: filing.subjectMatter,
          activities: filing.activities,
          communications: filing.communications,
        },
      });

      // Edge: lobbying filing → client org
      const clientOrg = this.findOrgByName(organizations, filing.clientName);
      if (clientOrg) {
        this.addEdge({
          id: nextEdgeId(),
          source: filing.id,
          target: clientOrg.id,
          type: "lobbied_by",
          weight: 1,
          properties: {},
          sourceRef: filing.source,
        });
      }

      // Edge: lobbyist person → filing
      if (filing.registrant.personId) {
        this.addEdge({
          id: nextEdgeId(),
          source: filing.registrant.personId,
          target: filing.id,
          type: "filed_by",
          weight: 1,
          properties: { registrant: true },
          sourceRef: filing.source,
        });
      }

      // Edge: department → lobbying filing
      const instId = makeNodeId("organization", filing.institution);
      if (!this.nodes.has(instId)) {
        this.addNode({
          id: instId,
          type: "organization",
          label: filing.institution,
          properties: { type: "government_agency", synthetic: true },
        });
      }
      this.addEdge({
        id: nextEdgeId(),
        source: instId,
        target: filing.id,
        type: "communicated_with",
        weight: filing.communications.length || 1,
        properties: {},
        sourceRef: filing.source,
      });
    }

    // Add donation nodes + edges
    for (const donation of donations) {
      this.addNode({
        id: donation.id,
        type: "donation",
        label: `$${donation.amount} to ${donation.recipientName}`,
        properties: {
          amount: donation.amount,
          donorName: donation.donorName,
          recipientName: donation.recipientName,
          date: donation.date,
          isCorporate: donation.isCorporate,
        },
      });

      // Edge: donor person/org → donation
      if (donation.donorPersonId) {
        this.addEdge({
          id: nextEdgeId(),
          source: donation.donorPersonId,
          target: donation.id,
          type: "donated_by",
          weight: donation.amount,
          properties: {},
          sourceRef: donation.source,
        });
      }
      if (donation.donorOrganizationId) {
        this.addEdge({
          id: nextEdgeId(),
          source: donation.donorOrganizationId,
          target: donation.id,
          type: "donated_by",
          weight: donation.amount,
          properties: {},
          sourceRef: donation.source,
        });
      }
    }

    // Add disclosure nodes + edges
    for (const disclosure of disclosures) {
      this.addNode({
        id: disclosure.id,
        type: "disclosure",
        label: `${disclosure.personName} — ${disclosure.department} ${disclosure.year}`,
        properties: {
          personName: disclosure.personName,
          department: disclosure.department,
          year: disclosure.year,
          interests: disclosure.interests,
          position: disclosure.position,
        },
      });

      if (disclosure.personId) {
        this.addEdge({
          id: nextEdgeId(),
          source: disclosure.personId,
          target: disclosure.id,
          type: "disclosed_by",
          weight: 1,
          properties: {},
          sourceRef: disclosure.source,
        });
      }
    }

    // Add GAC project nodes + edges
    for (const project of gacProjects) {
      this.addNode({
        id: project.id,
        type: "gac_project",
        label: project.title,
        properties: {
          projectId: project.projectId,
          country: project.country,
          budget: project.budget,
          implementingPartners: project.implementingPartners,
          sector: project.sector,
        },
      });

      // Edge: implementing partner org → project
      for (const partner of project.implementingPartners) {
        const partnerOrg = this.findOrgByName(organizations, partner.name);
        if (partnerOrg) {
          this.addEdge({
            id: nextEdgeId(),
            source: partnerOrg.id,
            target: project.id,
            type: "implements",
            weight: project.budget,
            properties: { partnerRole: partner.role },
            sourceRef: project.source,
          });
        }
      }
    }

    // Add person → organization employment edges from roles
    for (const person of persons) {
      for (const role of person.roles) {
        const org = this.findOrgByName(organizations, role.organization);
        if (org) {
          this.addEdge({
            id: nextEdgeId(),
            source: person.id,
            target: org.id,
            type: "employed_at",
            weight: 1,
            properties: {
              title: role.title,
              department: role.department,
              startDate: role.startDate,
              endDate: role.endDate,
              category: role.category,
            },
            sourceRef: role.source,
          });
        }
      }
    }

    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      threads: this.threads,
    };
  }

  /**
   * Find an organization node by name, using fuzzy matching.
   */
  private findOrgByName(
    organizations: Organization[],
    name: string,
  ): Organization | undefined {
    // Exact match first
    const exact = organizations.find((org) =>
      org.names.some((n) => n.toLowerCase() === name.toLowerCase()),
    );
    if (exact) return exact;

    // Fuzzy match via resolver
    for (const org of organizations) {
      for (const orgName of org.names) {
        const score = this.resolver.resolveOrgNames(orgName, name);
        if (score >= 0.85) return org;
      }
    }

    return undefined;
  }

  /** Get current graph data */
  getGraphData(): GraphData {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      threads: this.threads,
    };
  }

  /** Get all nodes */
  getAllNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  /** Get all edges */
  getAllEdges(): Edge[] {
    return Array.from(this.edges.values());
  }

  /** Set intelligence threads */
  setThreads(threads: IntelligenceThread[]): void {
    this.threads = threads;
  }
}
