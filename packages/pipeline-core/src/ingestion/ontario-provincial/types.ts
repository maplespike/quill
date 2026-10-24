// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Ontario CKAN Package Record
 * Represents a dataset package from data.ontario.ca CKAN portal
 */
export interface OntarioCKANRecord {
  name: string;
  title: string;
  notes?: string;
  organization?: {
    title: string;
    name: string;
    id: string;
  };
  maintainer?: string;
  metadata_created?: string;
  metadata_modified?: string;
  id: string;
  resources: OntarioCKANResource[];
}

/**
 * Ontario CKAN Resource Record
 * Represents a resource (file) within a CKAN package
 */
export interface OntarioCKANResource {
  name: string;
  format?: string;
  url: string;
  created?: string;
  last_modified?: string;
  size?: number | string;
  id: string;
  package_id: string;
  description?: string;
  mimetype?: string;
  resource_type?: string;
}

/**
 * Ontario Provincial Result
 * Unified result type for Ontario provincial data ingestion
 */
export interface OntarioProvincialResult {
  id: string;
  packageName: string;
  packageTitle: string;
  packageDescription?: string;
  organizationName?: string;
  organizationId?: string;
  maintainer?: string;
  resourceName: string;
  resourceFormat?: string;
  resourceUrl: string;
  resourceSize?: number;
  createdDate?: string;
  lastModifiedDate?: string;
  sourceSystem: 'ontario-ckan-parser';
  ckanPackageId: string;
  ckanResourceId: string;
  ingestedAt: string;
}