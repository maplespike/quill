// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Pipeline stage registry for the MapleSpike data pipeline
 */
import { GraphBuilder } from "./graph/GraphBuilder.js";
import { BriefGenerator } from "./brief/BriefGenerator.js";

/**
 * Registry of available pipeline stages
 */
export const pipelineStages = {
  graphBuilder: GraphBuilder,
  briefGenerator: BriefGenerator,
};

/**
 * Type for pipeline stage constructors
 */
export type PipelineStageConstructor = new (...args: any[]) => any;

/**
 * Get a pipeline stage constructor by name
 */
export function getPipelineStage(name: string): PipelineStageConstructor | undefined {
  return pipelineStages[name as keyof typeof pipelineStages];
}

/**
 * List all available pipeline stage names
 */
export function listPipelineStages(): string[] {
  return Object.keys(pipelineStages);
}