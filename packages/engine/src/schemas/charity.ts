// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const CharityTypeSchema = z.enum([
  "charitable_organization",
  "public_foundation",
  "private_foundation",
  "other",
]);

export const CharityStatusSchema = z.enum([
  "registered",
  "revoked",
  "suspended",
  "pending",
  "other",
]);

export const FinancialSummarySchema = z.object({
  totalRevenue: z.number(),
  totalExpenses: z.number(),
  assets: z.number(),
  year: z.number(),
  currency: z.string(),
});

export const BoardMemberSchema = z.object({
  personId: z.string().optional(),
  personName: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  isCompensated: z.boolean(),
});

export const CharityActivitySchema = z.object({
  category: z.string(),
  description: z.string(),
  beneficiaries: z.string(),
});

export const CharitySchema = z.object({
  id: z.string(),
  names: z.array(z.string()),
  registrationNumber: z.string().optional(),
  type: CharityTypeSchema,
  status: CharityStatusSchema,
  mandate: z.string(),
  activities: z.array(CharityActivitySchema),
  financials: z.array(FinancialSummarySchema),
  boardMembers: z.array(BoardMemberSchema),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  website: z.string().optional(),
  parentOrganizationId: z.string().optional(),
  source: z.string(),
  rawData: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});