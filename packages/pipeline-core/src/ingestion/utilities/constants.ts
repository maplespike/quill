// SPDX-License-Identifier: AGPL-3.0-only
export interface UtilityProvider {
  id: string;
  name: string;
  province: string;
  type: 'hydro' | 'gas' | 'water' | 'telecom';
  url: string;
  serviceArea: string;
}

export const UTILITY_PROVIDERS: UtilityProvider[] = [
  { id: 'hydro-one', name: 'Hydro One', province: 'ON', type: 'hydro', url: 'https://www.hydroone.com', serviceArea: 'Ontario' },
  { id: 'hydro-quebec', name: 'Hydro-Québec', province: 'QC', type: 'hydro', url: 'https://www.hydroquebec.com', serviceArea: 'Quebec' },
  { id: 'bc-hydro', name: 'BC Hydro', province: 'BC', type: 'hydro', url: 'https://www.bchydro.com', serviceArea: 'British Columbia' },
  { id: 'enmax', name: 'ENMAX', province: 'AB', type: 'hydro', url: 'https://www.enmax.com', serviceArea: 'Calgary area' },
  { id: 'epcor', name: 'EPCOR', province: 'AB', type: 'hydro', url: 'https://www.epcor.com', serviceArea: 'Edmonton area' },
  { id: 'saskpower', name: 'SaskPower', province: 'SK', type: 'hydro', url: 'https://www.saskpower.com', serviceArea: 'Saskatchewan' },
  { id: 'manitoba-hydro', name: 'Manitoba Hydro', province: 'MB', type: 'hydro', url: 'https://www.hydro.mb.ca', serviceArea: 'Manitoba' },
  { id: 'nspower', name: 'Nova Scotia Power', province: 'NS', type: 'hydro', url: 'https://www.nspower.ca', serviceArea: 'Nova Scotia' },
  { id: 'nb-power', name: 'NB Power', province: 'NB', type: 'hydro', url: 'https://www.nbpower.com', serviceArea: 'New Brunswick' },
  { id: 'nl-hydro', name: 'Newfoundland and Labrador Hydro', province: 'NL', type: 'hydro', url: 'https://www.nlhydro.com', serviceArea: 'Newfoundland and Labrador' },
  { id: 'pei-energy', name: 'Maritime Electric', province: 'PE', type: 'hydro', url: 'https://www.maritimeelectric.com', serviceArea: 'Prince Edward Island' },
  { id: 'enbridge', name: 'Enbridge Gas', province: 'ON', type: 'gas', url: 'https://www.enbridgegas.com', serviceArea: 'Ontario' },
  { id: 'fortis-bc', name: 'Fortis BC', province: 'BC', type: 'gas', url: 'https://www.fortisbc.com', serviceArea: 'British Columbia' },
  { id: 'atco-gas', name: 'ATCO Gas', province: 'AB', type: 'gas', url: 'https://www.atco.com', serviceArea: 'Alberta' },
  { id: 'energir', name: 'Énergir', province: 'QC', type: 'gas', url: 'https://www.energir.com', serviceArea: 'Quebec' },
];

export const UTILITY_TIMEOUT_MS = 10_000;
export const UTILITY_USER_AGENT = 'MapleSpike-Utility/1.0';
