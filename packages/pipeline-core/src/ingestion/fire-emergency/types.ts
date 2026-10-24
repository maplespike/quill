// SPDX-License-Identifier: AGPL-3.0-only

export interface FireIncident {
  id: string;
  city: string;
  province: string;
  date: Date;
  incidentType: string;
  address?: string;
  description?: string;
}

export interface ResponseTime {
  city: string;
  province: string;
  year: number;
  averageResponseTime: number;
  incidentType: string;
}

export interface Station {
  id: string;
  city: string;
  province: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export const FIRE_DEPARTMENTS = [
  { city: 'Edmonton', province: 'AB', url: 'https://data.edmonton.ca' },
  { city: 'Montreal', province: 'QC', url: 'https://donnees.montreal.ca' },
  { city: 'Quebec City', province: 'QC', url: 'https://www.ville.quebec.qc.ca' },
  { city: 'Sherbrooke', province: 'QC', url: 'https://www.ville.sherbrooke.qc.ca' },
];