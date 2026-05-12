/**
 * Brief Generator — barrel export
 */

export type { LobbyingPulse, SignalCounts, SpendingPulse } from "./generator";
export { BriefGenerator } from "./generator";
export type { Severity } from "./templates";
export {
  classifySeverity,
  donationProximityTemplate,
  getTemplate,
  internationalLayeringTemplate,
  mandateDivergenceTemplate,
  procurementLobbyingTemplate,
  revolvingDoorTemplate,
  SIGNAL_DISPLAY_NAMES,
  sectionTitleForSignalType,
  soleSourceHeavyLobbyingTemplate,
  spousalInterestTemplate,
  threadOneLiner,
} from "./templates";
