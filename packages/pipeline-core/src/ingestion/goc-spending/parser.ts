// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { GoCContract, GoCDeptSpending, GoCVendorSpending } from './types.js';

export async function toGoCContract(row: Record<string, string>, now: string): Promise<GoCContract> {
  const vendor = row.vendor_name || row.vendor || row.contractor || null;
  const dept = row.department || row.owner_org || row.organization || null;
  if (!vendor && !dept && !row.description) throw new Error('Invalid contract row');

  const value = parseFloat((row.value || row.contract_value || row.amount || '0').replace(/[$,]/g, ''));
  const sy = parseInt(row.start_year || row.effective_start_year || row.year || '0', 10);
  const ey = parseInt(row.end_year || row.effective_end_year || '0', 10);
  const content = JSON.stringify(row);
  const id = await computeHash(content, 'sha256');

  return {
    id,
    vendor,
    vendorNormalized: row.vendor_normalized || row.cleaned_vendor_name || null,
    department: dept,
    description: row.description || row.commodity_description || null,
    value: isNaN(value) ? null : value,
    startYear: isNaN(sy) ? null : sy,
    endYear: isNaN(ey) ? null : ey,
    source: 'GoC-Spending',
    referenceNumber: row.reference_number || row.ref_number || row.contract_id || null,
    contractDate: row.contract_date || row.date || null,
    procurementMethod: row.procurement_method || null,
    tradeAgreementExemption: row.trade_agreement_exemption || null,
    isDuplicate: (row.duplicate_flag || '').toLowerCase() === 'true',
    isError: (row.error_flag || '').toLowerCase() === 'true',
    dataHash: id,
    ingestedAt: now,
  };
}

export async function toGoCDeptSpending(row: Record<string, string>, now: string): Promise<GoCDeptSpending> {
  const dept = row.department || '';
  const fiscal = row.fiscal_year || '';
  if (!dept || !fiscal) throw new Error('Invalid department spending row');

  const count = parseInt(row.entries || '0', 10);
  const value = parseFloat((row.value || '0').replace(/[$,]/g, ''));
  const hash = await computeHash(`goc-dept:${dept}:${fiscal}`, 'sha256');

  return {
    department: dept,
    fiscalYear: fiscal,
    contractCount: isNaN(count) ? 0 : count,
    totalValue: isNaN(value) ? 0 : value,
    avgValue: count > 0 ? value / count : 0,
    dataHash: hash,
    ingestedAt: now,
  };
}

export async function toGoCVendorSpending(row: Record<string, string>, now: string): Promise<GoCVendorSpending> {
  const vendor = row.vendor || row.vendor_name || '';
  if (!vendor) throw new Error('Invalid vendor spending row');

  const totalContracts = parseInt(row.total_contracts || row.contracts || '0', 10);
  const totalValue = parseFloat((row.total_value || row.value || '0').replace(/[$,]/g, ''));
  const firstYear = parseInt(row.first_year || row.min_year || '0', 10);
  const lastYear = parseInt(row.last_year || row.max_year || '0', 10);
  const hash = await computeHash(`goc-vendor:${vendor}`, 'sha256');

  return {
    vendor,
    vendorNormalized: row.vendor_normalized || row.cleaned_vendor_name || vendor,
    totalContracts: isNaN(totalContracts) ? 0 : totalContracts,
    totalValue: isNaN(totalValue) ? 0 : totalValue,
    firstYear: isNaN(firstYear) ? 0 : firstYear,
    lastYear: isNaN(lastYear) ? 0 : lastYear,
    dataHash: hash,
    ingestedAt: now,
  };
}

export async function parseGoCContracts(rows: Record<string, string>[], maxRecords: number): Promise<GoCContract[]> {
  const now = new Date().toISOString();
  const contracts: GoCContract[] = [];

  for (const row of rows) {
    if (contracts.length >= maxRecords) break;
    try {
      const contract = await toGoCContract(row, now);
      contracts.push(contract);
    } catch (err) {
      console.warn(`[GoC-Spending] Failed to parse contract row: ${(err as Error).message}`);
    }
  }

  return contracts;
}

export async function parseGoCDeptSpending(rows: Record<string, string>[]): Promise<GoCDeptSpending[]> {
  const now = new Date().toISOString();
  const spending: GoCDeptSpending[] = [];

  for (const row of rows) {
    try {
      const dept = await toGoCDeptSpending(row, now);
      spending.push(dept);
    } catch (err) {
      console.warn(`[GoC-Spending] Failed to parse dept spending row: ${(err as Error).message}`);
    }
  }

  return spending;
}

export async function parseGoCVendorSpending(rows: Record<string, string>[]): Promise<GoCVendorSpending[]> {
  const now = new Date().toISOString();
  const spending: GoCVendorSpending[] = [];

  for (const row of rows) {
    try {
      const vendor = await toGoCVendorSpending(row, now);
      spending.push(vendor);
    } catch (err) {
      console.warn(`[GoC-Spending] Failed to parse vendor spending row: ${(err as Error).message}`);
    }
  }

  return spending;
}