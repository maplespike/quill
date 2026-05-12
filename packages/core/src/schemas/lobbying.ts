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
  id: z.string().uuid(),
  source: GovernmentSourceSchema,
  rawData: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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
