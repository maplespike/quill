// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const GovernmentSourceSchema = z.enum([
  "open_canada_contracts",
  "lobbying_commissioner",
  "elections_canada",
  "disclosure_clerk",
  "gac_projects",
  "open_canada_orgs",
  "manual",
]);

export const BaseEntitySchema = z.object({
  // z.guid() keeps the Zod 3 z.string().uuid() rule: any 8-4-4-4-12 hex id.
  // z.uuid() rejects an id whose variant nibble is not 8, 9, a, or b.
  id: z.guid(),
  source: GovernmentSourceSchema,
  rawData: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
