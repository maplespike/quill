// SPDX-License-Identifier: AGPL-3.0-or-later

export interface CrimeStatistics {
  id: string;
  city: string;
  province: string;
  year: number;
  crimeType: string;
  count: number;
  ratePer100k: number;
  neighborhood?: string;
}

export interface ResponseTime {
  city: string;
  province: string;
  year: number;
  averageResponseTime: number;
  priorityLevel: string;
}

export interface IncidentReport {
  id: string;
  city: string;
  province: string;
  date: Date;
  incidentType: string;
  location?: string;
  description?: string;
}

export interface UseOfForce {
  city: string;
  province: string;
  year: number;
  incidents: number;
  officerInjuries: number;
  subjectInjuries: number;
}

export const POLICE_AGENCIES = [
  { city: 'Edmonton', province: 'AB', url: 'https://data.edmonton.ca' },
  { city: 'Montreal', province: 'QC', url: 'https://donnees.montreal.ca' },
  { city: 'Quebec City', province: 'QC', url: 'https://www.ville.quebec.qc.ca' },
  { city: 'Sherbrooke', province: 'QC', url: 'https://www.ville.sherbrooke.qc.ca' },
  { city: 'Calgary', province: 'AB', url: 'https://data.calgary.ca' },
  { city: 'Vancouver', province: 'BC', url: 'https://opendata.vancouver.ca' },
];