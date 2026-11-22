import { z } from "zod";
import { GovernmentSourceSchema } from "./base";

export const DonationSchema = z.object({
  id: z.string(),
  source: GovernmentSourceSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  party: z.string(),
  riding: z.string(),
  amountBand: z.string(),
  contributionCount: z.number().int().nonnegative(),
  totalAmount: z.number().nonnegative(),
  jurisdiction: z.string().optional(),
});
