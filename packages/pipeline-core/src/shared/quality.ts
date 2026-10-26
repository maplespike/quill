// SPDX-License-Identifier: AGPL-3.0-only

export type DataQualityLevel = 'high' | 'medium' | 'low' | 'unknown';
export type DataQualityIssue = 'missing' | 'incomplete' | 'outdated' | 'inconsistent' | 'unverified';

export interface DataQualityMetadata {
  level: DataQualityLevel;
  issues: DataQualityIssue[];
  completeness: number;
  confidence: number;
  lastVerified?: Date;
  notes?: string;
}

export interface QualityFlaggedRecord {
  data: unknown;
  quality: DataQualityMetadata;
}

export function buildQualityMetadata(
  level: DataQualityLevel,
  issues: DataQualityIssue[] = [],
  completeness = 1.0,
  confidence = 1.0
): DataQualityMetadata {
  return {
    level,
    issues,
    completeness,
    confidence,
  };
}

export function withQuality<T>(data: T, quality: DataQualityMetadata): QualityFlaggedRecord {
  return { data, quality };
}

export function checkQuality(data: unknown): DataQualityLevel {
  if (!data) return 'low';
  if (Array.isArray(data) && data.length === 0) return 'low';
  if (typeof data === 'object') return 'medium';
  return 'high';
}