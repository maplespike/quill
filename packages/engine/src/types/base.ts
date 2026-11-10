// SPDX-License-Identifier: AGPL-3.0-only
/** Government data source identifiers */
export type GovernmentSource =
  | "open_canada_contracts"
  | "lobbying_commissioner"
  | "elections_canada"
  | "disclosure_clerk"
  | "gac_projects"
  | "open_canada_orgs"
  | "manual";

/** Base fields shared by all entity types */
export interface BaseEntity {
  id: string;
  source: GovernmentSource;
  rawData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
