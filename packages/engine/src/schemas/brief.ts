// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import { SignalTypeSchema } from "./graph";

export const BriefSectionSchema = z.object({
  title: z.string(),
  content: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  signalTypes: z.array(SignalTypeSchema).optional(),
});

export const BriefSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  sections: z.array(BriefSectionSchema),
  entityIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  generatedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().optional(),
});
