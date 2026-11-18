// SPDX-License-Identifier: AGPL-3.0-only
export interface OCCompany {
  name: string;
  companyNumber: string;
  jurisdictionCode: string;
  incorporationDate?: string;
  companyType?: string;
  status?: string;
  address?: string;
  agentName?: string;
  url: string;
}

export interface OCOfficer {
  name: string;
  position: string;
  startDate?: string;
  endDate?: string;
  officerType?: string;
  occupation?: string;
}

export interface OCFiling {
  title: string;
  date?: string;
  filingType?: string;
  url?: string;
}

export interface OCRelationship {
  type: string;
  companyName: string;
  companyNumber: string;
  jurisdictionCode: string;
  startDate?: string;
}

export interface OCSearchResult {
  results: OCCompany[];
  total: number;
  page: number;
  attribution: string;
  source: string;
  license: string;
}
