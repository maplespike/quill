// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import { GovernmentSourceSchema } from "./base";

export const OrganizationTypeSchema = z.enum([
  "corporation",
  "non_profit",
  "lobbying_firm",
  "consultancy",
  "industry_association",
  "government_agency",
  "crown_corporation",
  "trade_union",
  "other",
]);

export const RegistrationSchema = z.object({
  number: z.string(),
  jurisdiction: z.string(),
  type: z.string(),
  status: z.enum(["active", "inactive", "dissolved"]),
  dateFiled: z.string(),
  source: GovernmentSourceSchema,
});

export const OrganizationSchema = z.object({
  id: z.guid(),
  source: GovernmentSourceSchema,
  rawData: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  names: z.array(z.string()),
  type: OrganizationTypeSchema,
  registrations: z.array(RegistrationSchema),
  industry: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  website: z.url().optional(),
  parentOrganizationId: z.guid().optional(),
});
