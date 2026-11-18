// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Graph Builder + Signal Detectors — barrel export
 */

export { GraphBuilder, makeNodeId } from "./builder";
export {
  findEntitiesByName,
  getSubgraph,
  getThreadsForEntity,
  getTopSignals,
} from "./queries";
export { detectCycles } from "./cycles";
export type { Cycle } from "./cycles";
export { computeMetrics } from "./metrics";
export type { GraphMetrics } from "./metrics";
export { validateGraphData, validateNode, validateEdge } from "./validation";
export type { ValidatedNode, ValidatedEdge, ValidatedGraphData } from "./schemas";
export {
  detectDonationProximityCorrelation,
  detectInternationalLayering,
  detectMandateDivergence,
  detectProcurementLobbyingOverlap,
  detectRevolvingDoor,
  detectSoleSourceHeavyLobbying,
  detectSpousalInterestProximity,
  runAllDetectors,
  isoNow,
} from "./signals";
