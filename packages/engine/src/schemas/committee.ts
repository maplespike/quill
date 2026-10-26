import { z } from "zod";

export const CommitteeTypeSchema = z.enum([
  "standing",
  "special",
  "joint",
  "subcommittee",
  "other",
]);

export const CommitteeScopeSchema = z.enum([
  "federal",
  "provincial",
  "municipal",
  "other",
]);

export const CommitteeMeetingSchema = z.object({
  date: z.string(),
  type: z.enum(["regular", "emergency", "in_camera"]),
  location: z.string().optional(),
  agenda: z.array(z.string()).optional(),
  attendees: z.array(z.string()).optional(),
});

export const CommitteeMemberSchema = z.object({
  personId: z.string().optional(),
  personName: z.string(),
  role: z.enum(["chair", "vice_chair", "member", "clerk"]),
  startDate: z.string(),
  endDate: z.string().optional(),
  party: z.string().optional(),
  riding: z.string().optional(),
});

export const CommitteeSchema = z.object({
  id: z.string(),
  names: z.array(z.string()),
  type: CommitteeTypeSchema,
  scope: CommitteeScopeSchema,
  chamber: z.string().optional(),
  mandate: z.string(),
  members: z.array(CommitteeMemberSchema),
  meetings: z.array(CommitteeMeetingSchema),
  parentCommitteeId: z.string().optional(),
  source: z.string(),
  rawData: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});