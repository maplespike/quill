/**
 * Elections Canada Third-Party Advertiser Registry — Quill
 *
 * Strongly-typed interfaces for the Elections Canada registry of
 * third-party advertisers who spend money on Canadian federal election
 * advertising outside of political parties.
 *
 * This covers "dark money in elections" — unions, corporations, issue
 * groups, and individuals who engage in election advertising.
 *
 * Sources:
 *   - Third Party Registry Search:
 *     https://www.elections.ca/content2.aspx?section=pol&dir=thi&document=index&lang=e
 *   - Financial reports (CKAN / open.canada.ca):
 *     https://open.canada.ca/data/en/dataset?q=third+party+election+advertising
 *   - Elections Canada CSV exports
 */


/** Type of third-party advertiser as defined by the Canada Elections Act */
export type ThirdPartyType =
  | 'union'
  | 'corporation'
  | 'issue-group'
  | 'individual'
  | 'other';


/** The regulatory period in which advertising spending occurred */
export type ElectionPeriodType =
  /** The 60-day pre-election period before the writ is dropped */
  | 'pre-election'
  /** The official election period (from writ drop to election day) */
  | 'election'
  /** Between elections (outside the 60-day pre-election + election windows) */
  | 'between-elections';

export interface ElectionPeriod {
  /** Type of election period */
  type: ElectionPeriodType;
  /** Election name / identifier (e.g. "45th General Election") */
  electionName: string | null;
  /** Start date of the period (ISO-8601) */
  startDate: string | null;
  /** End date of the period (ISO-8601) */
  endDate: string | null;
}


export type AdvertisingPlatform =
  | 'digital'
  | 'print'
  | 'broadcast'
  | 'radio'
  | 'outdoor'
  | 'telephone'
  | 'other';


export interface ThirdPartyAd {
  /** SHA-256 citation hash of the registry record (primary key) */
  id: string;

  /** Registrant (organization or individual) name */
  registrantName: string;

  /** Type of registrant */
  registrantType: ThirdPartyType;

  /** Street address of the registrant */
  address: string | null;

  /** City */
  city: string | null;

  /** Province / territory */
  province: string | null;

  /** Postal code */
  postalCode: string | null;

  /** Registrant telephone number */
  telephone: string | null;

  /** Name of the responsible officer (for organizations) */
  officerName: string | null;

  /** Officer title (e.g. "President", "Secretary-Treasurer") */
  officerTitle: string | null;

  /** The electoral district(s) being targeted (federal riding) */
  targetedRidings: string[];

  /** Issue focus / subject matter of the advertising campaign */
  issueFocus: string[];

  /** Advertising platforms used */
  platforms: AdvertisingPlatform[];

  /** Election period(s) this registration covers */
  electionPeriod: ElectionPeriod;

  /** Total spending declared (CAD) */
  totalSpending: number | null;

  /** Spending limit for this period (CAD) */
  spendingLimit: number | null;

  /** Registration number assigned by Elections Canada */
  registrationNumber: string | null;

  /** Registration date (ISO-8601) */
  registrationDate: string | null;

  /** Is the registrant also an influence actor tracked in the influence module? */
  isTrackedInfluenceActor: boolean;

  /** Reference to influence_actors.id if cross-referenced */
  influenceActorId: string | null;

  /** Is the registrant a tracked corporate entity? */
  isTrackedCorporateEntity: boolean;

  /** Reference to corporate_entities.corporation_number if cross-referenced */
  corporateEntityNumber: string | null;

  /** Source URL where this record was found */
  sourceUrl: string;

  /** Source system identifier (e.g. "elections-ca-registry", "ckan", "html-scrape") */
  sourceSystem: string;

  /** CKAN package ID if sourced from open.canada.ca */
  ckanPackageId: string | null;

  /** CKAN resource ID if sourced from a specific resource */
  ckanResourceId: string | null;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}


export interface ThirdPartySpending {
  /** SHA-256 citation hash (primary key) */
  id: string;

  /** Reference to the advertiser's registry record */
  thirdPartyAdId: string;

  /** Registrant name (denormalized for query performance) */
  registrantName: string;

  /** Fiscal year or election event */
  reportingPeriod: string;

  /** Advertising platform */
  platform: AdvertisingPlatform;

  /** Amount spent (CAD) */
  amount: number;

  /** Category of spending (e.g. "production", "placement", "administration") */
  spendingCategory: string | null;

  /** Vendor / supplier paid for this expense */
  vendorName: string | null;

  /** Electoral district targeted (if specified) */
  targetedRiding: string | null;

  /** Date of expenditure (ISO-8601) */
  expenseDate: string | null;

  /** Source URL */
  sourceUrl: string;

  /** Source system identifier */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}


export interface ElectionsIngestionResult {
  source: string;
  recordsFound: number;
  recordsIngested: number;
  categoriesFound: Record<ThirdPartyType, number>;
  totalSpending: number;
  errors: string[];
  durationMs: number;
}


/**
 * Shape of a raw record from Elections Canada HTML, CKAN CSV export,
 * or the third-party registry search page.
 */
export interface RawThirdPartyRecord {
  /** Registrant name */
  registrantName?: string;
  /** Registrant type string */
  registrantType?: string;
  /** Address */
  address?: string;
  /** City */
  city?: string;
  /** Province */
  province?: string;
  /** Postal code */
  postalCode?: string;
  /** Telephone */
  telephone?: string;
  /** Officer name */
  officerName?: string;
  /** Officer title */
  officerTitle?: string;
  /** Targeted ridings (comma-separated or stringified array) */
  targetedRidings?: string;
  /** Issue focus (comma-separated or stringified array) */
  issueFocus?: string;
  /** Platforms (comma-separated or stringified array) */
  platforms?: string;
  /** Election period type */
  electionPeriodType?: string;
  /** Election name */
  electionName?: string;
  /** Period start date */
  periodStart?: string;
  /** Period end date */
  periodEnd?: string;
  /** Total spending */
  totalSpending?: string;
  /** Spending limit */
  spendingLimit?: string;
  /** Registration number */
  registrationNumber?: string;
  /** Registration date */
  registrationDate?: string;
  /** Source URL */
  sourceUrl?: string;

  /** Raw CSV data (from CKAN exports), parsed inline */
  rawCsvData?: string;

  /** Raw HTML (from HTML scraping fallback), parsed inline */
  rawHtml?: string;

  /** Catch-all for any other fields from the source */
  [key: string]: unknown;
}

/** Shape of a raw spending record from CSV exports */
export interface RawThirdPartySpendingRecord {
  /** Registrant name */
  registrantName?: string;
  /** Registration number */
  registrationNumber?: string;
  /** Reporting period */
  reportingPeriod?: string;
  /** Platform */
  platform?: string;
  /** Amount */
  amount?: string;
  /** Spending category */
  spendingCategory?: string;
  /** Vendor name */
  vendorName?: string;
  /** Targeted riding */
  targetedRiding?: string;
  /** Expense date */
  expenseDate?: string;
  /** Source URL */
  sourceUrl?: string;

  /** Raw CSV data (from CKAN exports), parsed inline */
  rawCsvData?: string;

  /** Raw HTML (from HTML scraping fallback), parsed inline */
  rawHtml?: string;

  /** Catch-all */
  [key: string]: unknown;
}
