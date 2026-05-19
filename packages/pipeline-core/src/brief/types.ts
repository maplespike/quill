// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Brief and signal data types
 */

export interface Brief {
  id: string;
  title: string;
  summary: string;
  sections: BriefSection[];
  citations: BriefCitation[];
  metadata: Record<string, unknown>;
  generatedAt: string;
  expiresAt?: string;
}

export interface BriefSection {
  title: string;
  content: string;
  order: number;
}

export interface BriefCitation {
  id: string;
  source: string;
  entityIds: string[];
  confidence: number;
}

export interface Signal {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  entityName: string;
  description: string;
  relatedEntities: string[];
  citedSources: string[];
  confidence: number;
  detectedAt: string;
}

export interface BriefTemplate {
  name: string;
  template: string;
  render(data: Record<string, unknown>): string;
}

export interface BriefGeneratorOptions {
  templateDir?: string;
  defaultTemplate?: string;
}