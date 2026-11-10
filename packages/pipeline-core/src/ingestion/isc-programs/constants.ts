// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ISC Constants — Quill
 *
 * Configuration for Indigenous Services Canada data sources.
 */

export const CKAN_BASE = 'https://open.canada.ca/data/en';

export const ISC_PACKAGES = {
  COMMUNITY_SAFETY: 'indigenous-community-safety',
} as const;

export const PROGRAM_TYPES = [
  'infrastructure',
  'policing',
  'prevention',
  'emergency-response',
  'justice',
  'other',
] as const;