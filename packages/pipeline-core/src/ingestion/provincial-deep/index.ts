// SPDX-License-Identifier: AGPL-3.0-or-later
import { fetchAllProvincialDeep } from './fetcher.js';
import type { ProvincialDeepDataset, ProvincialDeepIngestionResult } from './types.js';
export async function ingestAllProvincialDeep(): Promise<ProvincialDeepIngestionResult> { return fetchAllProvincialDeep(); }
export type { ProvincialDeepDataset, ProvincialDeepIngestionResult };