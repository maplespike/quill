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
export type { MandatePromise } from "./signals";
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
