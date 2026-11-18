// SPDX-License-Identifier: AGPL-3.0-only
import type { BaseEntity, GovernmentSource } from "./base";

export type RoleCategory =
  | "elected"
  | "appointed"
  | "civil_service"
  | "political_staff"
  | "lobbyist"
  | "consultant"
  | "corporate"
  | "other";

export interface Role {
  title: string;
  organization: string;
  department?: string;
  startDate: string;
  endDate?: string;
  category: RoleCategory;
  source: GovernmentSource;
}

export type RelationshipType =
  | "employment"
  | "contractual"
  | "lobbying"
  | "donation"
  | "spousal"
  | "familial"
  | "board_membership"
  | "consultancy"
  | "partnership"
  | "association";

export interface Relationship {
  type: RelationshipType;
  targetId: string;
  targetType: "person" | "organization";
  label: string;
  startDate?: string;
  endDate?: string;
  source: GovernmentSource;
}

export interface Person extends BaseEntity {
  names: string[];
  firstName?: string;
  lastName?: string;
  email?: string;
  roles: Role[];
  relationships: Relationship[];
  province?: string;
  city?: string;
}
