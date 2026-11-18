// SPDX-License-Identifier: AGPL-3.0-only
import type { BaseEntity, GovernmentSource } from "./base";

export type DonationRecipientType =
  | "political_party"
  | "leadership_candidate"
  | "nomination_contestant"
  | "candidate"
  | "riding_association"
  | "third_party";

export interface Donation extends BaseEntity {
  donorName: string;
  donorPersonId?: string;
  donorOrganizationId?: string;
  recipientName: string;
  recipientType: DonationRecipientType;
  amount: number;
  currency: string;
  date: string;
  province?: string;
  riding?: string;
  isCorporate: boolean;
  source: GovernmentSource;
}
