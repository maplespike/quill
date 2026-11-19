import type { BaseEntity, GovernmentSource } from "./base";

/** Aggregate donation. No donor name. */
export interface Donation extends Omit<BaseEntity, "rawData"> {
  party: string;
  riding: string;
  amountBand: string;
  contributionCount: number;
  totalAmount: number;
  jurisdiction?: string;
  source: GovernmentSource;
}
