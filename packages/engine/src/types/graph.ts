// SPDX-License-Identifier: AGPL-3.0-only
export type SignalType =
  | "procurement_lobbying_overlap"
  | "revolving_door"
  | "spousal_interest_proximity"
  | "sole_source_heavy_lobbying"
  | "donation_proximity_correlation"
  | "mandate_divergence"
  | "international_layering";

export type NodeType =
  | "person"
  | "organization"
  | "contract"
  | "lobbying_filing"
  | "donation"
  | "disclosure"
  | "gac_project"
  | "committee"
  | "charity";

export type EdgeType =
  | "awarded_to"
  | "lobbied_by"
  | "donated_by"
  | "disclosed_by"
  | "employed_at"
  | "partnered_with"
  | "related_to"
  | "communicated_with"
  | "filed_by"
  | "implements"
  | "member_of"
  | "testified_before"
  | "chairs"
  | "funds"
  | "board_member_of"
  | "executive_director_of"
  | "affiliated_with"
  | "advisor_to";

export interface Node {
  id: string;
  type: NodeType;
  label: string;
  properties: Record<string, unknown>;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
  properties: Record<string, unknown>;
  sourceRef: string;
}

export interface IntelligenceThread {
  id: string;
  title: string;
  description: string;
  signalType: SignalType;
  confidence: number;
  nodes: string[];
  edges: string[];
  sources: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
  threads: IntelligenceThread[];
}
