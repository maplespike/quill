// SPDX-License-Identifier: AGPL-3.0-only
/**
 * IRCC Constants — Quill
 *
 * Configuration for Immigration, Refugees and Citizenship Canada data sources.
 */

export const CKAN_BASE = 'https://open.canada.ca/data/en';

export const IRCC_PACKAGES = {
  FAMILY_SPONSORSHIP: 'family-sponsorship',
} as const;

export const SPONSOR_CATEGORIES = [
  'spousal',
  'parent',
  'grandparent',
  'dependent-child',
  'other-relative',
] as const;