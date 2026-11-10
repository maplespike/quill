// SPDX-License-Identifier: AGPL-3.0-only
import type { BaseEntity, GovernmentSource } from "./base";

export type InterestCategory =
  | "real_property"
  | "securities"
  | "corporations"
  | "partnerships"
  | "liabilities"
  | "other";

export interface Interest {
  category: InterestCategory;
  description: string;
  value?: string;
  province?: string;
}

export interface Disclosure extends BaseEntity {
  personName: string;
  personId?: string;
  position: string;
  department: string;
  year: number;
  interests: Interest[];
  province?: string;
  filingDate: string;
  source: GovernmentSource;
}
