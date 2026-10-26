import { z } from "zod";
import { GovernmentSourceSchema } from "./base";

export const CommunicationTypeSchema = z.enum([
  "meeting",
  "call",
  "email",
  "letter",
  "conference",
  "other",
]);

export const LobbyistSchema = z.object({
  name: z.string(),
  firmName: z.string().optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
});

export const LobbyingCommunicationSchema = z.object({
  date: z.string(),
  type: CommunicationTypeSchema,
  subjectMatter: z.string(),
  officials: z.array(z.string()),
  institution: z.string(),
});

export const LobbyingFilingSchema = z.object({
  id: z.guid(),
  source: GovernmentSourceSchema,
  rawData: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  filingNumber: z.string(),
  registrant: LobbyistSchema,
  clientName: z.string(),
  clientOrganizationId: z.string().optional(),
  subjectMatter: z.string(),
  communications: z.array(LobbyingCommunicationSchema),
  startDate: z.string(),
  endDate: z.string(),
  activities: z.array(z.string()),
  institution: z.string(),
  province: z.string().optional(),
});
