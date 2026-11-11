// SPDX-License-Identifier: AGPL-3.0-only

import type { IssuerStatusRecord } from './types.js';

/**
 * A label correction keeps the source filing date and the historical status.
 * It does not mark a current review green.
 */
export function applyIssuerLabelCorrection(
  record: IssuerStatusRecord,
  displayName: string,
): IssuerStatusRecord {
  return {
    issuerCik: record.issuerCik,
    displayName,
    classes: record.classes.map((item) => ({ classTitleAsFiled: item.classTitleAsFiled })),
    incorporation: {
      status: 'historical-only',
      sourceFilingDate: record.incorporation.sourceFilingDate,
      currentStatus: 'not-reverified',
      review: 'unreviewed',
    },
  };
}

/** Issuer identity and class title stay a pair. Classes are not merged. */
export function classIdentity(issuerCik: string, classTitleAsFiled: string): string {
  return `${issuerCik}\n${classTitleAsFiled}`;
}

export function collapseSecurityClasses(): { allowed: false; classes: null } {
  return { allowed: false, classes: null };
}
