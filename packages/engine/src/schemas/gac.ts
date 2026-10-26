import { z } from "zod";
import { GovernmentSourceSchema } from "./base";

export const GACProjectStatusSchema = z.enum([
  "active",
  "completed",
  "cancelled",
  "pipeline",
  "suspended",
]);

export const ImplementingPartnerSchema = z.object({
  name: z.string(),
  organizationId: z.string().optional(),
  country: z.string(),
  role: z.string(),
});

export const GACProjectSchema = z.object({
  id: z.guid(),
  source: GovernmentSourceSchema,
  rawData: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  projectId: z.string(),
  title: z.string(),
  description: z.string(),
  department: z.string(),
  country: z.string(),
  region: z.string(),
  budget: z.number().nonnegative(),
  currency: z.string().length(3),
  startDate: z.string(),
  endDate: z.string().optional(),
  status: GACProjectStatusSchema,
  implementingPartners: z.array(ImplementingPartnerSchema),
  sector: z.string().optional(),
});
