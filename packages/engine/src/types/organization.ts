// SPDX-License-Identifier: AGPL-3.0-only
import type { BaseEntity, GovernmentSource } from "./base";

export type OrganizationType =
  | "corporation"
  | "non_profit"
  | "lobbying_firm"
  | "consultancy"
  | "industry_association"
  | "government_agency"
  | "crown_corporation"
  | "trade_union"
  | "other";

export interface Registration {
  number: string;
  jurisdiction: string;
  type: string;
  status: "active" | "inactive" | "dissolved";
  dateFiled: string;
  source: GovernmentSource;
}

export interface Organization extends BaseEntity {
  names: string[];
  type: OrganizationType;
  registrations: Registration[];
  industry?: string;
  province?: string;
  city?: string;
  website?: string;
  parentOrganizationId?: string;
}
