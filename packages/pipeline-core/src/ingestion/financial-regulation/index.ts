import { ingestFCAC } from './fetcher.js';
export { ingestOSFI, ingestCDIC, ingestFCAC, ingestAllFinancialRegulation } from './fetcher.js';
export const ingestFCACComplaints = ingestFCAC;
export type { BankData, InsuranceData, CDICMember, Complaint, FinRegRecord, FinRegIngestionResult } from './types.js';
