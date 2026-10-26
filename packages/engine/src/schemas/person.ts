import { z } from "zod";
import { GovernmentSourceSchema } from "./base";

export const RoleCategorySchema = z.enum([
  "elected",
  "appointed",
  "civil_service",
  "political_staff",
  "lobbyist",
  "consultant",
  "corporate",
  "other",
]);

export const RoleSchema = z.object({
  title: z.string(),
  organization: z.string(),
  department: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  category: RoleCategorySchema,
  source: GovernmentSourceSchema,
});

export const RelationshipTypeSchema = z.enum([
  "employment",
  "contractual",
  "lobbying",
  "donation",
  "spousal",
  "familial",
  "board_membership",
  "consultancy",
  "partnership",
  "association",
]);

export const RelationshipSchema = z.object({
  type: RelationshipTypeSchema,
  targetId: z.string(),
  targetType: z.enum(["person", "organization"]),
  label: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  source: GovernmentSourceSchema,
});

export const PersonSchema = z.object({
  id: z.guid(),
  source: GovernmentSourceSchema,
  rawData: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  names: z.array(z.string()),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.email().optional(),
  roles: z.array(RoleSchema),
  relationships: z.array(RelationshipSchema),
  province: z.string().optional(),
  city: z.string().optional(),
});
