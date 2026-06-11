// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Templates module — Scaffolding for creating new ingestion modules
 * This is a placeholder module that provides basic structure for new modules.
 */

import { httpGet } from '../../utils/http.js';

// Placeholder functions - to be implemented when creating actual modules
export async function placeholderFunction() {
  return { message: 'Templates module - implement actual functions when creating new modules' };
}

export const ingestFunctions = ['placeholderFunction'];
