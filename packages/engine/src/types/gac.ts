// SPDX-License-Identifier: AGPL-3.0-only
import type { BaseEntity, GovernmentSource } from "./base";

export type GACProjectStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "pipeline"
  | "suspended";

export interface ImplementingPartner {
  name: string;
  organizationId?: string;
  country: string;
  role: string;
}

export interface GACProject extends BaseEntity {
  projectId: string;
  title: string;
  description: string;
  department: string;
  country: string;
  region: string;
  budget: number;
  currency: string;
  startDate: string;
  endDate?: string;
  status: GACProjectStatus;
  implementingPartners: ImplementingPartner[];
  sector?: string;
  source: GovernmentSource;
}
