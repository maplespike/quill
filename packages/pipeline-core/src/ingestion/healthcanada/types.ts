/**
 * Health Canada Ingestion — MapleSpike Pipeline
 *
 * Types for Health Canada data modules (drug approvals, medical devices, food recalls, etc.)
 */

export interface DrugApproval {
  id: string;
  drugName: string;
  manufacturer: string;
  approvalDate: string;
  status: 'Active' | 'Inactive' | 'Withdrawn' | 'Suspended' | 'Under Review';
  source: string;
  citationHash?: string;
  trustScore?: number;
}

export interface MedicalDevice {
  id: string;
  deviceName: string;
  manufacturer: string;
  licenceDate: string;
  status: 'Licensed' | 'Expired' | 'Suspended' | 'Cancelled';
  source: string;
  citationHash?: string;
  trustScore?: number;
}

export interface FoodRecall {
  id: string;
  product: string;
  hazard: string;
  date: string;
  distribution: string[];
  source: string;
  citationHash?: string;
  trustScore?: number;
}

export interface AdverseReaction {
  id: string;
  drugName: string;
  reaction: string;
  date: string;
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Life-threatening' | 'Fatal';
  source: string;
  citationHash?: string;
  trustScore?: number;
}

export interface PesticideRegistration {
  id: string;
  productName: string;
  activeIngredient: string;
  registrationDate: string;
  status: 'Registered' | 'Expired' | 'Cancelled' | 'Suspended';
  source: string;
  citationHash?: string;
  trustScore?: number;
}

export interface CannabisLicence {
  id: string;
  licenceHolder: string;
  province: string;
  licenceType: string;
  facility: string;
  source: string;
  citationHash?: string;
  trustScore?: number;
}

export interface ControlledSubstance {
  id: string;
  substance: string;
  authorization: string;
  facility: string;
  province: string;
  source: string;
  citationHash?: string;
  trustScore?: number;
}

export type HealthCanadaRecord = 
  | DrugApproval 
  | MedicalDevice 
  | FoodRecall 
  | AdverseReaction 
  | PesticideRegistration 
  | CannabisLicence 
  | ControlledSubstance;

export interface IngestionResult<T> {
  totalFetched: number;
  totalIngested: number;
  errors: string[];
  durationMs: number;
  records: T[];
}