// SPDX-License-Identifier: AGPL-3.0-only
import type { BaseEntity, GovernmentSource } from "./base";

export type ContractStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "amended"
  | "pending";

export type TenderStatus =
  | "open"
  | "closed"
  | "awarded"
  | "cancelled"
  | "amended";

export interface Contract extends BaseEntity {
  contractNumber: string;
  title: string;
  description: string;
  vendorName: string;
  vendorId?: string;
  department: string;
  value: number;
  currency: string;
  startDate: string;
  endDate?: string;
  status: ContractStatus;
  isSoleSource: boolean;
  province?: string;
  commodityType?: string;
  source: GovernmentSource;
}

export interface Tender extends BaseEntity {
  solicitationNumber: string;
  title: string;
  description: string;
  department: string;
  estimatedValue?: number;
  currency: string;
  publishDate: string;
  closingDate: string;
  status: TenderStatus;
  isSoleSource: boolean;
  province?: string;
  source: GovernmentSource;
}
