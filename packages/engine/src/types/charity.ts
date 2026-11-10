// SPDX-License-Identifier: AGPL-3.0-only
import type { BaseEntity, GovernmentSource } from "./base";

export type CharityType =
  | "charitable_organization"
  | "public_foundation"
  | "private_foundation"
  | "other";

export type CharityStatus =
  | "registered"
  | "revoked"
  | "suspended"
  | "pending"
  | "other";

export interface CharityActivity {
  category: string;
  description: string;
  beneficiaries: string;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  assets: number;
  year: number;
  currency: string;
}

export interface BoardMember {
  personId?: string;
  personName: string;
  title: string;
  startDate: string;
  endDate?: string;
  isCompensated: boolean;
}

export interface Charity extends BaseEntity {
  names: string[];
  registrationNumber?: string; // CRA BN
  type: CharityType;
  status: CharityStatus;
  mandate: string;
  activities: CharityActivity[];
  financials: FinancialSummary[];
  boardMembers: BoardMember[];
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  website?: string;
  parentOrganizationId?: string;
  source: GovernmentSource;
}