// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import { GovernmentSourceSchema } from "./base";

export const InterestCategorySchema = z.enum([
  "real_property",
  "securities",
  "corporations",
  "partnerships",
  "liabilities",
  "other",
]);

export const InterestSchema = z.object({
  category: InterestCategorySchema,
  description: z.string(),
  value: z.string().optional(),
  province: z.string().optional(),
});

export const DisclosureSchema = z.object({
  id: z.guid(),
  source: GovernmentSourceSchema,
  rawData: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  personName: z.string(),
  personId: z.string().optional(),
  position: z.string(),
  department: z.string(),
  year: z.number().int().min(1900).max(2100),
  interests: z.array(InterestSchema),
  province: z.string().optional(),
  filingDate: z.string(),
});
