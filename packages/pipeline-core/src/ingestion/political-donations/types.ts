// SPDX-License-Identifier: AGPL-3.0-only

export interface Donation {
  id: string;
  jurisdiction: string;
  date: Date;
  donorName: string;
  donorType: 'individual' | 'corporation';
  amount: number;
  recipient: string;
  recipientType: 'party' | 'candidate' | 'association' | 'third-party';
}

export const JURISDICTIONS = [
  'BC',
  'Ontario',
  'Quebec',
  'Alberta',
  'Saskatchewan',
  'Manitoba',
  'New Brunswick',
  'Nova Scotia',
  'PEI',
  'Newfoundland and Labrador',
  'Yukon',
  'Northwest Territories',
  'Nunavut',
];

export interface ContributionRecord {
  id: string;
  jurisdiction: string;
  donor: string;
  amount: number;
  date?: string;
  party?: string;
  category?: string;
}

export interface ContributionSummary {
  totalContributions: number;
  totalAmount: number;
  averageAmount: number;
  maxAmount: number;
  minAmount: number;
}