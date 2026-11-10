// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Brief Text Templates
 *
 * Template functions that generate human-readable descriptions for each
 * signal type. These produce the narrative prose for intelligence briefs.
 */

import type { IntelligenceThread, SignalType } from "../types/graph";

/**
 * Signal type display names for brief sections.
 */
export const SIGNAL_DISPLAY_NAMES: Record<SignalType, string> = {
  procurement_lobbying_overlap: "Procurement–Lobbying Overlap",
  revolving_door: "Revolving Door",
  spousal_interest_proximity: "Spousal Interest Proximity",
  sole_source_heavy_lobbying: "Sole-Source + Heavy Lobbying",
  donation_proximity_correlation: "Donation–Contract Proximity",
  mandate_divergence: "Mandate Divergence",
  international_layering: "International Layering",
};

/**
 * Severity classification based on signal type and confidence.
 */
export type Severity = "critical" | "high" | "moderate" | "low";

export function classifySeverity(
  signalType: SignalType,
  confidence: number,
): Severity {
  // Certain signal types are inherently more severe
  const severityBoost: Partial<Record<SignalType, number>> = {
    revolving_door: 0.1,
    procurement_lobbying_overlap: 0.05,
    sole_source_heavy_lobbying: 0.1,
    spousal_interest_proximity: 0.05,
  };

  const adjusted = confidence + (severityBoost[signalType] ?? 0);

  if (adjusted >= 0.9) return "critical";
  if (adjusted >= 0.8) return "high";
  if (adjusted >= 0.7) return "moderate";
  return "low";
}

/**
 * Generate a human-readable template for a procurement-lobbying overlap.
 */
export function procurementLobbyingTemplate(
  thread: IntelligenceThread,
): string {
  return (
    thread.description ||
    `A vendor was awarded a government contract while simultaneously lobbying the same department. ` +
      `This overlap raises questions about procurement fairness and potential undue influence.`
  );
}

/**
 * Generate a human-readable template for a revolving door signal.
 */
export function revolvingDoorTemplate(thread: IntelligenceThread): string {
  return (
    thread.description ||
    `A former public office holder is now lobbying the same department they previously served. ` +
      `This revolving door pattern creates potential conflicts of interest and insider access concerns.`
  );
}

/**
 * Generate a human-readable template for spousal interest proximity.
 */
export function spousalInterestTemplate(thread: IntelligenceThread): string {
  return (
    thread.description ||
    `A public office holder has a disclosed spousal interest in an entity that ` +
      `received contracts from their department, creating a potential conflict of interest.`
  );
}

/**
 * Generate a human-readable template for sole-source heavy lobbying.
 */
export function soleSourceHeavyLobbyingTemplate(
  thread: IntelligenceThread,
): string {
  return (
    thread.description ||
    `A vendor received a sole-source contract after extensive lobbying of the awarding department. ` +
      `The combination of non-competitive procurement and concentrated lobbying warrants scrutiny.`
  );
}

/**
 * Generate a human-readable template for donation proximity.
 */
export function donationProximityTemplate(thread: IntelligenceThread): string {
  return (
    thread.description ||
    `A political donor also received a government contract in close temporal proximity. ` +
      `While not evidence of wrongdoing, this pattern deserves monitoring.`
  );
}

/**
 * Generate a human-readable template for mandate divergence.
 */
export function mandateDivergenceTemplate(thread: IntelligenceThread): string {
  return (
    thread.description ||
    `Government spending appears to contradict a mandate letter commitment, ` +
      `suggesting a gap between political promises and actual expenditure.`
  );
}

/**
 * Generate a human-readable template for international layering.
 */
export function internationalLayeringTemplate(
  thread: IntelligenceThread,
): string {
  return (
    thread.description ||
    `An organization operates simultaneously across domestic procurement, ` +
      `international development projects, and lobbying — a multi-role presence that ` +
      `creates complex accountability challenges.`
  );
}

/**
 * Get the appropriate template function for a signal type.
 */
export function getTemplate(
  signalType: SignalType,
): (thread: IntelligenceThread) => string {
  const templates: Record<SignalType, (thread: IntelligenceThread) => string> =
    {
      procurement_lobbying_overlap: procurementLobbyingTemplate,
      revolving_door: revolvingDoorTemplate,
      spousal_interest_proximity: spousalInterestTemplate,
      sole_source_heavy_lobbying: soleSourceHeavyLobbyingTemplate,
      donation_proximity_correlation: donationProximityTemplate,
      mandate_divergence: mandateDivergenceTemplate,
      international_layering: internationalLayeringTemplate,
    };
  return templates[signalType];
}

/**
 * Generate a brief one-liner for a thread.
 */
export function threadOneLiner(thread: IntelligenceThread): string {
  const template = getTemplate(thread.signalType);
  const text = template(thread);
  // Take first sentence, truncate if too long
  const firstSentence = text.split(/\.\s/)[0];
  if (firstSentence.length > 200) {
    return `${firstSentence.substring(0, 197)}...`;
  }
  return firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;
}

/**
 * Generate a section title for a group of signals of the same type.
 */
export function sectionTitleForSignalType(
  signalType: SignalType,
  count: number,
): string {
  const name = SIGNAL_DISPLAY_NAMES[signalType];
  return `${name} (${count} ${count === 1 ? "signal" : "signals"})`;
}
