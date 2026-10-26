// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { SERVICES_BASE } from './constants.js';

export async function fetchServicesDirectory(): Promise<unknown> {
  const response = await httpGet(SERVICES_BASE);
  return response;
}