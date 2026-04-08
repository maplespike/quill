import { z } from "zod";

export const SignalTypeSchema = z.enum([
	"procurement_lobbying_overlap",
	"revolving_door",
	"spousal_interest_proximity",
	"sole_source_heavy_lobbying",
	"donation_proximity_correlation",
	"mandate_divergence",
	"international_layering",
]);

export const NodeTypeSchema = z.enum([
	"person",
	"organization",
	"contract",
	"lobbying_filing",
	"donation",
	"disclosure",
	"gac_project",
]);

export const EdgeTypeSchema = z.enum([
	"awarded_to",
	"lobbied_by",
	"donated_by",
	"disclosed_by",
	"employed_at",
	"partnered_with",
	"related_to",
	"communicated_with",
	"filed_by",
	"implements",
]);

export const NodeSchema = z.object({
	id: z.string(),
	type: NodeTypeSchema,
	label: z.string(),
	properties: z.record(z.unknown()),
});

export const EdgeSchema = z.object({
	id: z.string(),
	source: z.string(),
	target: z.string(),
	type: EdgeTypeSchema,
	weight: z.number(),
	properties: z.record(z.unknown()),
	sourceRef: z.string(),
});

export const IntelligenceThreadSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
	signalType: SignalTypeSchema,
	confidence: z.number().min(0).max(1),
	nodes: z.array(z.string()),
	edges: z.array(z.string()),
	sources: z.array(z.string()),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});

export const GraphDataSchema = z.object({
	nodes: z.array(NodeSchema),
	edges: z.array(EdgeSchema),
	threads: z.array(IntelligenceThreadSchema),
});
