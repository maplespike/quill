// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * UNESCO Institute for Statistics (UIS) Type Definitions
 *
 * Provides types for education, culture, and science indicators
 * accessed via the UNESCO SDMX REST API.
 */

/** Dimension value in SDMX structure */
export interface UnescoDimensionValue {
  id: string;
  name: string;
  order: number;
  parent?: string;
  annotations?: number[];
}

/** Dimension in SDMX structure */
export interface UnescoDimension {
  id: string;
  name: string;
  keyPosition: number;
  roles: string[];
  values: UnescoDimensionValue[];
}

/** Attribute in SDMX structure */
export interface UnescoAttribute {
  id: string;
  name: string;
  roles: string[];
  relationship?: { dimensions: string[] | { observation: {} } };
  values: UnescoAttributeValue[];
}

export interface UnescoAttributeValue {
  id: string;
  name: string;
  order: number;
  annotations?: number[];
}

/** Data structure definition in SDMX response */
export interface UnescoDataStructure {
  dimensions: {
    series: UnescoDimension[];
    observation: UnescoDimension[];
  };
  attributes: {
    dataSet: UnescoAttribute[];
    dimensionGroup: UnescoAttribute[];
    series: UnescoAttribute[];
    observation: UnescoAttribute[];
  };
}

/** Annotation in SDMX response */
export interface UnescoAnnotation {
  title: string;
  type: string;
  texts?: Record<string, string>;
}

/** Data series in SDMX response */
export interface UnescoDataSeries {
  key: string;
  attributes: (number | null)[];
  annotations: number[];
  observations: Record<string, (number | null)[]>;
}

/** Data set in SDMX response */
export interface UnescoDataSet {
  structure: number;
  action: string;
  links: Array<{ urn: string; rel: string }>;
  annotations: number[];
  series: Record<string, UnescoDataSeries>;
}

/** Full SDMX response from UNESCO API */
export interface UnescoSdmxResponse {
  meta: {
    schema: string;
    id: string;
    prepared: string;
    test: boolean;
    contentLanguages: string[];
    sender: { id: string; name: string; names: Record<string, string> };
  };
  data: {
    structures: UnescoDataStructure[];
    dataSets: UnescoDataSet[];
    annotations: UnescoAnnotation[];
  };
  errors: Array<Record<string, unknown>>;
}

/** A single UNESCO indicator observation record */
export interface UnescoRecord {
  /** Indicator code (e.g., 'EDU_LITR_AD_ZS') */
  indicatorCode: string;
  /** Human-readable indicator name */
  indicatorName: string;
  /** Indicator category (education, culture, science) */
  category: string;
  /** ISO 3-letter country code */
  refArea: string;
  /** Country name */
  refAreaName: string;
  /** Year of observation */
  year: number;
  /** Numeric value of the indicator */
  value: number | null;
  /** Frequency (A = annual) */
  frequency: string;
  /** Education level (e.g., 'PRY', 'SEC', 'TER') */
  educationLevel?: string;
  /** Sex breakdown ('M', 'F', 'ALL') */
  sex?: string;
  /** Age group */
  ageGroup?: string;
  /** Unit of measure */
  unitMeasure?: string;
  /** Unit multiplier */
  unitMult?: string;
  /** Observation status */
  obsStatus?: string;
  /** Timestamp when record was ingested */
  ingestedAt: string;
  /** Source URL for the data */
  sourceUrl: string;
}

/** Result of a single UNESCO dataset ingestion */
export interface UnescoIngestionResult {
  /** Dataflow ID */
  dataflowId: string;
  /** Human-readable dataflow name */
  dataflowName: string;
  /** Number of records found */
  recordsFound: number;
  /** Number of records successfully ingested */
  recordsIngested: number;
  /** Error messages encountered */
  errors: string[];
  /** Processing duration in milliseconds */
  durationMs: number;
}

/** UNESCO indicator metadata */
export interface UnescoIndicator {
  /** Indicator code */
  code: string;
  /** Human-readable name */
  name: string;
  /** Category (education, culture, science) */
  category: 'education' | 'culture' | 'science';
  /** Description */
  description?: string;
  /** Unit of measurement */
  unit?: string;
}
