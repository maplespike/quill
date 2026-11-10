// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import { GovernmentSourceSchema } from "./base";

export const ContractStatusSchema = z.enum([
  "active",
  "completed",
  "cancelled",
  "amended",
  "pending",
]);

export const TenderStatusSchema = z.enum([
  "open",
  "closed",
  "awarded",
  "cancelled",
  "amended",
]);

export const ContractSchema = z.object({
  id: z.guid(),
  source: GovernmentSourceSchema,
  rawData: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  contractNumber: z.string(),
  title: z.string(),
  description: z.string(),
  vendorName: z.string(),
  vendorId: z.string().optional(),
  department: z.string(),
  value: z.number().nonnegative(),
  currency: z.string().length(3),
  startDate: z.string(),
  endDate: z.string().optional(),
  status: ContractStatusSchema,
  isSoleSource: z.boolean(),
  province: z.string().optional(),
  commodityType: z.string().optional(),
});

export const TenderSchema = z.object({
  id: z.guid(),
  source: GovernmentSourceSchema,
  rawData: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  solicitationNumber: z.string(),
  title: z.string(),
  description: z.string(),
  department: z.string(),
  estimatedValue: z.number().nonnegative().optional(),
  currency: z.string().length(3),
  publishDate: z.string(),
  closingDate: z.string(),
  status: TenderStatusSchema,
  isSoleSource: z.boolean(),
  province: z.string().optional(),
});
