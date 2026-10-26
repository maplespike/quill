// SPDX-License-Identifier: AGPL-3.0-only

export const OECD_BASE_URL = 'https://stats.oecd.org/sdmx-json/data';

export const OECD_TIMEOUT_MS = 30_000;
export const OECD_USER_AGENT = 'MapleSpike-OECD/1.0';

import type { OECDDataset } from './types.js';

export const OECD_DATASETS: OECDDataset[] = [
  { id: 'QNA', name: 'Quarterly National Accounts' },
  { id: 'MEI', name: 'Main Economic Indicators' },
  { id: 'STLABOUR', name: 'Labour Statistics' },
  { id: 'AEG_HEALTH', name: 'Health Statistics' },
  { id: 'ST_ETP', name: 'Education and Training' },
];

export const OECD_DATASET_URLS: Record<string, string> = {
  QNA: `${OECD_BASE_URL}/QNA/CAN.GDP+B1_GE/Q/MEI`,
  MEI: `${OECD_BASE_URL}/MEI/CAN/AUSP/Q`,
  STLABOUR: `${OECD_BASE_URL}/STLABOUR/CAN/T.LN.AGR_Q/A.Q`,
  AEG_HEALTH: `${OECD_BASE_URL}/AEG_HEALTH/CAN/LHEXP.AGR/CHELSE.PP.AGR/PC?dimensionAtObservation=AllDimensions`,
  ST_ETP: `${OECD_BASE_URL}/ST_ETP/CAN/EAG/AV_EDU_Q.FIN_E_Q`,
};

export const DEFAULT_DATASETS = ['QNA', 'MEI', 'STLABOUR'];
