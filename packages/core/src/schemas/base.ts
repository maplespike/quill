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
	id: z.string().uuid(),
	source: GovernmentSourceSchema,
	rawData: z.record(z.unknown()),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});
