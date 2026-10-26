import { z } from "zod";
import { GovernmentSourceSchema } from "./base";

export const DonationRecipientTypeSchema = z.enum([
  "political_party",
  "leadership_candidate",
  "nomination_contestant",
  "candidate",
  "riding_association",
  "third_party",
]);

export const DonationSchema = z.object({
  id: z.guid(),
  source: GovernmentSourceSchema,
  rawData: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  donorName: z.string(),
  donorPersonId: z.string().optional(),
  donorOrganizationId: z.string().optional(),
  recipientName: z.string(),
  recipientType: DonationRecipientTypeSchema,
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
  date: z.string(),
  province: z.string().optional(),
  riding: z.string().optional(),
  isCorporate: z.boolean(),
});
