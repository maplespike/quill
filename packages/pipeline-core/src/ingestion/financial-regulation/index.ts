// SPDX-License-Identifier: AGPL-3.0-only
import { ingestFCAC } from './fetcher.js';
export { ingestOSFI, ingestCDIC, ingestFCAC, ingestCSA, ingestOBSI, ingestAllFinancialRegulation } from './fetcher.js';
export {
  parseOSFIRecord,
  parseCDICRecord,
  parseFCACRecord,
  parseFinancialRegulationRecords,
  parseGenericFinRegRecord,
} from './parser.js';
export const ingestFCACComplaints = ingestFCAC;
export type { BankData, InsuranceData, CDICMember, Complaint, FinRegRecord, FinRegIngestionResult } from './types.js';
export { crossReferenceBankingLobbying } from './cross-reference.js';
export type { BankingLobbyingMatch, BankingLobbyingReport } from './cross-reference.js';
