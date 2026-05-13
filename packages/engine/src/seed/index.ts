/**
 * Seed — Load pipeline data or provide empty-state fallback
 *
 * Re-exports the loader function and type for external use.
 * No hardcoded mock data — all data comes from portal pipeline output.
 */

export { loadPipelineData, getSeedParsedData } from "./data";
export type { PipelineData } from "./data";
