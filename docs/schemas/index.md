---
last-reviewed: 2026-11-09
status: generated
---

# Module schema index

> Generated from `packages/pipeline-core/src` by
> `scripts/generate-schemas-index.mts`. Do not edit by hand — run the
> generator instead. `pnpm test:schemas-index` fails when this file drifts.

Quill versions module schemas so external MCP servers, SDK clients and
local agents can validate payloads before they call a tool. The same
inventory is served by the MCP server as JSON at `quill://schemas`;
per-module field-level schemas are at `quill://schemas/{module}`.

**820 schemas across 5 modules.**

## Modules

| Module | Schemas | Fields | Required fields | Resource |
|--------|---------|--------|-----------------|----------|
| `audit` | 2 | 16 | 8 | `quill://schemas/audit` |
| `ingestion` | 797 | 6221 | 4746 | `quill://schemas/ingestion` |
| `test-framework` | 7 | 47 | 37 | `quill://schemas/test-framework` |
| `validation` | 6 | 35 | 23 | `quill://schemas/validation` |
| `verification` | 8 | 50 | 42 | `quill://schemas/verification` |

## Schemas by module

### `audit`

| Schema | File | Fields | Required fields |
|--------|------|--------|-----------------|
| `AuditEntry` | `audit/logger.ts` | 10 | `timestamp`, `operation`, `model`, `inputPreview`, `outputSummary`, `confidence`, `success`, `durationMs` |
| `AuditQueryFilter` | `audit/logger.ts` | 6 | — |

### `ingestion`

| Schema | File | Fields | Required fields |
|--------|------|--------|-----------------|
| `A2ajCoverageItem` | `ingestion/a2aj/types.ts` | 6 | `dataset`, `descriptionEn`, `descriptionFr`, `earliestDocumentDate`, `latestDocumentDate`, `numberOfDocuments` |
| `A2ajDocument` | `ingestion/a2aj/types.ts` | 5 | `citation`, `title`, `text`, `dataset`, `language` |
| `A2ajIngestionResult` | `ingestion/a2aj/types.ts` | 5 | `coverage`, `documents`, `searches`, `errors`, `durationMs` |
| `A2ajSearchResult` | `ingestion/a2aj/types.ts` | 5 | `citation`, `title`, `snippet`, `dataset`, `score` |
| `AbCourtsIngestionOptions` | `ingestion/ab-courts/types.ts` | 4 | — |
| `AbCourtsIngestionResult` | `ingestion/ab-courts/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `AbCourtsRecord` | `ingestion/ab-courts/types.ts` | 11 | `id`, `recordType`, `courtType`, `fileNumber`, `filingDate`, `caseType`, `location`, `status`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawAbCourtsRecord` | `ingestion/ab-courts/types.ts` | 7 | — |
| `AbEconomicIngestionOptions` | `ingestion/ab-economic/types.ts` | 4 | — |
| `AbEconomicIngestionResult` | `ingestion/ab-economic/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `AbEconomicRecord` | `ingestion/ab-economic/types.ts` | 14 | `id`, `recordType`, `category`, `subcategory`, `value`, `unit`, `period`, `fiscalYear`, `region`, `status`, `description`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawAbEconomicRecord` | `ingestion/ab-economic/types.ts` | 10 | — |
| `AbEducationIngestionOptions` | `ingestion/ab-education/types.ts` | 4 | — |
| `AbEducationIngestionResult` | `ingestion/ab-education/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `AbEducationRecord` | `ingestion/ab-education/types.ts` | 14 | `id`, `recordType`, `category`, `schoolAuthority`, `schoolName`, `academicYear`, `grade`, `subject`, `result`, `studentCount`, `fundingAmount`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawAbEducationRecord` | `ingestion/ab-education/types.ts` | 10 | — |
| `ABHealthSourceConfig` | `ingestion/ab-health/constants.ts` | 4 | `label`, `ckanUrl`, `sourceSystem`, `defaultLimit` |
| `ABHealthIngestionOptions` | `ingestion/ab-health/types.ts` | 6 | — |
| `ABHealthIngestionResult` | `ingestion/ab-health/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `ABHealthRecord` | `ingestion/ab-health/types.ts` | 9 | `id`, `title`, `topic`, `publicationDate`, `dataType`, `url`, `summary`, `sourceSystem`, `ingestedAt` |
| `ABHealthSearchOptions` | `ingestion/ab-health/types.ts` | 5 | — |
| `AHSRecord` | `ingestion/ab-health/types.ts` | 10 | `id`, `category`, `measure`, `value`, `region`, `fiscalYear`, `quarter`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `CkanApiRecord` | `ingestion/ab-health/types.ts` | 6 | — |
| `CkanSearchResponse` | `ingestion/ab-health/types.ts` | 3 | — |
| `RawABHealthPublication` | `ingestion/ab-health/types.ts` | 11 | — |
| `RawAHSRecord` | `ingestion/ab-health/types.ts` | 11 | — |
| `AbImmigrationIngestionOptions` | `ingestion/ab-immigration/types.ts` | 4 | — |
| `AbImmigrationIngestionResult` | `ingestion/ab-immigration/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `AbImmigrationRecord` | `ingestion/ab-immigration/types.ts` | 11 | `id`, `recordType`, `stream`, `nominationsIssued`, `year`, `quarter`, `occupation`, `industry`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawAbImmigrationRecord` | `ingestion/ab-immigration/types.ts` | 7 | — |
| `AbInfrastructureIngestionOptions` | `ingestion/ab-infrastructure/types.ts` | 4 | — |
| `AbInfrastructureIngestionResult` | `ingestion/ab-infrastructure/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `AbInfrastructureRecord` | `ingestion/ab-infrastructure/types.ts` | 14 | `id`, `recordType`, `category`, `subcategory`, `value`, `unit`, `period`, `fiscalYear`, `region`, `status`, `description`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawAbInfrastructureRecord` | `ingestion/ab-infrastructure/types.ts` | 10 | — |
| `AgricultureIngestionResult` | `ingestion/agriculture/types.ts` | 5 | `source`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `AgricultureRecord` | `ingestion/agriculture/types.ts` | 12 | `id`, `year`, `category`, `subCategory`, `value`, `unit`, `description`, `region`, `commodity`, `sourceUrl`, `sourceName`, `ingestedAt` |
| `AtiIngestionOptions` | `ingestion/ati/types.ts` | 6 | — |
| `AtiIngestionResult` | `ingestion/ati/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perDepartment`, `durationMs` |
| `AtiRecord` | `ingestion/ati/types.ts` | 15 | `id`, `department`, `departmentAcronym`, `requestNumber`, `summary`, `disposition`, `pagesReleased`, `pagesWithheld`, `dateCompleted`, `fiscalYear`, `sourceUrl`, `ckanPackageId`, `ckanResourceId`, `sourceSystem`, `ingestedAt` |
| `RawAtiCkanPackage` | `ingestion/ati/types.ts` | 10 | `id`, `name`, `title`, `notes`, `organization`, `resources`, `metadata_created`, `metadata_modified` |
| `RawAtiRecord` | `ingestion/ati/types.ts` | 13 | — |
| `Citation` | `ingestion/attestation/index.ts` | 13 | `sourceName`, `sourceUrl`, `license`, `dataHash`, `retrievedAt`, `updateFrequency` |
| `AbsAttribute` | `ingestion/au-abs/types.ts` | 3 | `id`, `name`, `values` |
| `AbsDataflow` | `ingestion/au-abs/types.ts` | 5 | `id`, `name`, `agencyID`, `version` |
| `AbsDataStructure` | `ingestion/au-abs/types.ts` | 4 | `id`, `name`, `dimensions`, `attributes` |
| `AbsDimension` | `ingestion/au-abs/types.ts` | 3 | `id`, `name`, `values` |
| `AbsFactRecord` | `ingestion/au-abs/types.ts` | 8 | `id`, `dataflow`, `dataflowName`, `dimensions`, `value`, `period`, `lastUpdated` |
| `AbsIngestionResult` | `ingestion/au-abs/types.ts` | 5 | `dataflow`, `records`, `observationsExtracted`, `errors`, `durationMs` |
| `AbsSdmxJsonData` | `ingestion/au-abs/types.ts` | 2 | `structure`, `dataSets` |
| `BocFetchResult` | `ingestion/bank-of-canada/fetcher.ts` | 3 | `decisions`, `sourcesTried`, `errors` |
| `BocDecision` | `ingestion/bank-of-canada/types.ts` | 14 | `id`, `date`, `type`, `title`, `summary`, `url`, `keyRate`, `effectiveDate`, `speaker`, `speakerTitle`, `event`, `pdfUrl`, `language`, `ingestedAt` |
| `BocIngestionResult` | `ingestion/bank-of-canada/types.ts` | 5 | `decisionsFound`, `decisionsIngested`, `sourcesTried`, `errors`, `durationMs` |
| `BocRateHistoryEntry` | `ingestion/bank-of-canada/types.ts` | 4 | `date`, `effectiveDate`, `rate`, `label` |
| `BocRateScheduleEntry` | `ingestion/bank-of-canada/types.ts` | 2 | `date`, `label` |
| `BocSourceConfig` | `ingestion/bank-of-canada/types.ts` | 5 | `label`, `url`, `rssUrl`, `type`, `yearPattern` |
| `RawBocItem` | `ingestion/bank-of-canada/types.ts` | 7 | `title`, `date`, `url`, `summary`, `rawType`, `bodyHtml`, `speaker` |
| `RawBocPage` | `ingestion/bank-of-canada/types.ts` | 2 | `url`, `html` |
| `BcCourtsIngestionOptions` | `ingestion/bc-courts/types.ts` | 4 | — |
| `BcCourtsIngestionResult` | `ingestion/bc-courts/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `BcCourtsRecord` | `ingestion/bc-courts/types.ts` | 11 | `id`, `recordType`, `courtType`, `fileNumber`, `filingDate`, `caseType`, `location`, `status`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawBcCourtsRecord` | `ingestion/bc-courts/types.ts` | 7 | — |
| `BcEconomicIngestionOptions` | `ingestion/bc-economic/types.ts` | 4 | — |
| `BcEconomicIngestionResult` | `ingestion/bc-economic/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `BcEconomicRecord` | `ingestion/bc-economic/types.ts` | 14 | `id`, `recordType`, `category`, `subcategory`, `value`, `unit`, `period`, `fiscalYear`, `region`, `status`, `description`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawBcEconomicRecord` | `ingestion/bc-economic/types.ts` | 10 | — |
| `BcEducationIngestionOptions` | `ingestion/bc-education/types.ts` | 4 | — |
| `BcEducationIngestionResult` | `ingestion/bc-education/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `BcEducationRecord` | `ingestion/bc-education/types.ts` | 13 | `id`, `recordType`, `category`, `schoolDistrict`, `schoolName`, `academicYear`, `grade`, `subject`, `result`, `studentCount`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawBcEducationRecord` | `ingestion/bc-education/types.ts` | 9 | — |
| `BCHealthSourceConfig` | `ingestion/bc-health/constants.ts` | 4 | `label`, `url`, `sourceSystem`, `defaultLimit` |
| `BCCDCApiRecord` | `ingestion/bc-health/types.ts` | 6 | — |
| `BCCDCRecord` | `ingestion/bc-health/types.ts` | 8 | `id`, `title`, `topic`, `publicationDate`, `diseaseFocus`, `url`, `summary`, `ingestedAt` |
| `BCHealthIngestionOptions` | `ingestion/bc-health/types.ts` | 5 | — |
| `BCHealthIngestionResult` | `ingestion/bc-health/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `PharmaCareApiRecord` | `ingestion/bc-health/types.ts` | 8 | — |
| `PharmaCareRecord` | `ingestion/bc-health/types.ts` | 11 | `id`, `drugName`, `manufacturer`, `formularyStatus`, `atcCode`, `therapeuticCategory`, `claimCount`, `totalCost`, `fiscalYear`, `sourceUrl`, `ingestedAt` |
| `RawBCHealthRecord` | `ingestion/bc-health/types.ts` | 15 | — |
| `BcImmigrationIngestionOptions` | `ingestion/bc-immigration/types.ts` | 4 | — |
| `BcImmigrationIngestionResult` | `ingestion/bc-immigration/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `BcImmigrationRecord` | `ingestion/bc-immigration/types.ts` | 11 | `id`, `recordType`, `stream`, `nominationsIssued`, `year`, `quarter`, `occupation`, `industry`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawBcImmigrationRecord` | `ingestion/bc-immigration/types.ts` | 7 | — |
| `BcInfrastructureIngestionOptions` | `ingestion/bc-infrastructure/types.ts` | 4 | — |
| `BcInfrastructureIngestionResult` | `ingestion/bc-infrastructure/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `BcInfrastructureRecord` | `ingestion/bc-infrastructure/types.ts` | 14 | `id`, `recordType`, `category`, `subcategory`, `value`, `unit`, `period`, `fiscalYear`, `region`, `status`, `description`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawBcInfrastructureRecord` | `ingestion/bc-infrastructure/types.ts` | 10 | — |
| `CanliiDecision` | `ingestion/canlii/types.ts` | 20 | `id`, `databaseId`, `caseId`, `caseName`, `court`, `decisionDate`, `docketNumber`, `citation`, `allCitations`, `url`, `language`, `keywords`, `concatenatedId`, `summary`, `parties`, `citedCasesJson`, `citingCasesJson`, `citedLegislationJson`, `reviewsGovernmentAction`, `ingestedAt` |
| `CanliiIngestionResult` | `ingestion/canlii/types.ts` | 6 | `courts`, `decisionsFound`, `decisionsIngested`, `citationsFound`, `errors`, `durationMs` |
| `Court` | `ingestion/canlii/types.ts` | 5 | `courtId`, `databaseId`, `nameEn`, `nameFr`, `jurisdiction` |
| `LegalCitation` | `ingestion/canlii/types.ts` | 6 | `id`, `databaseId`, `caseId`, `title`, `citation`, `type` |
| `PartyInfo` | `ingestion/canlii/types.ts` | 3 | `plaintiff`, `defendant`, `interveners` |
| `RawCaseDetailResponse` | `ingestion/canlii/types.ts` | 10 | `databaseId`, `caseId`, `url`, `title`, `citation`, `language`, `docketNumber`, `decisionDate`, `keywords`, `concatenatedId` |
| `RawCaseListItem` | `ingestion/canlii/types.ts` | 4 | `databaseId`, `caseId`, `title`, `citation` |
| `RawCaseListResponse` | `ingestion/canlii/types.ts` | 1 | — |
| `RawCitatorItem` | `ingestion/canlii/types.ts` | 4 | `databaseId`, `caseId`, `title`, `citation` |
| `RawCitatorResponse` | `ingestion/canlii/types.ts` | 3 | — |
| `RawDatabaseEntry` | `ingestion/canlii/types.ts` | 3 | `databaseId`, `jurisdiction`, `name` |
| `RawDatabaseListResponse` | `ingestion/canlii/types.ts` | 1 | `caseDatabases` |
| `RawSearchResponse` | `ingestion/canlii/types.ts` | 2 | — |
| `RawSearchResult` | `ingestion/canlii/types.ts` | 6 | `databaseId`, `caseId`, `title`, `citation` |
| `ChangeState` | `ingestion/change-detect.ts` | 7 | `url`, `etag`, `lastModified`, `contentHash`, `lastCheckedAt`, `lastChangedAt`, `consecutiveUnchanged` |
| `ProbeResult` | `ingestion/change-detect.ts` | 4 | `url`, `changed`, `statusCode`, `reason` |
| `CipoSourceConfig` | `ingestion/cipo/constants.ts` | 4 | `label`, `apiUrl`, `sourceSystem`, `defaultLimit` |
| `CipoDesignApiRecord` | `ingestion/cipo/types.ts` | 9 | — |
| `CipoIngestionOptions` | `ingestion/cipo/types.ts` | 6 | — |
| `CipoIngestionResult` | `ingestion/cipo/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `CipoPatentApiRecord` | `ingestion/cipo/types.ts` | 11 | — |
| `CipoRecord` | `ingestion/cipo/types.ts` | 17 | `id`, `applicationNumber`, `filingDate`, `status`, `type`, `title`, `ownerName`, `agentName`, `ipcClassification`, `niceClassification`, `registrationDate`, `expiryDate`, `publicationDate`, `description`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `CipoTrademarkApiRecord` | `ingestion/cipo/types.ts` | 10 | — |
| `RawCipoRecord` | `ingestion/cipo/types.ts` | 15 | — |
| `CmhcSourceConfig` | `ingestion/cmhc/constants.ts` | 4 | `label`, `url`, `sourceSystem`, `defaultLimit` |
| `CmhcCkanRecord` | `ingestion/cmhc/types.ts` | 7 | — |
| `CmhcIngestionOptions` | `ingestion/cmhc/types.ts` | 7 | — |
| `CmhcIngestionResult` | `ingestion/cmhc/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perMetric`, `durationMs` |
| `CmhcRecord` | `ingestion/cmhc/types.ts` | 15 | `id`, `metricName`, `metricType`, `geographicArea`, `geographicLevel`, `period`, `periodStart`, `periodEnd`, `value`, `unit`, `housingType`, `seasonallyAdjusted`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawCmhcRecord` | `ingestion/cmhc/types.ts` | 13 | — |
| `ParsedEvidence` | `ingestion/committees/parser.ts` | 2 | `meeting`, `interventions` |
| `EvidenceStory` | `ingestion/committees/pipeline.ts` | 6 | `topic`, `committee`, `date`, `keySpeakers`, `recommendations`, `sourceUrl` |
| `CommitteeInfo` | `ingestion/committees/types.ts` | 4 | `acronym`, `nameEn`, `nameFr`, `category` |
| `CommitteeIngestionResult` | `ingestion/committees/types.ts` | 8 | `committee`, `meetingsFound`, `meetingsIngested`, `interventionsIngested`, `speakersFound`, `inCameraCount`, `errors`, `durationMs` |
| `CommitteeMeeting` | `ingestion/committees/types.ts` | 16 | `id`, `committeeAcronym`, `committeeName`, `chamber`, `parliament`, `session`, `meetingNumber`, `date`, `startTime`, `endTime`, `inCamera`, `inCameraNote`, `evidenceUrl`, `xmlUrl`, `subject`, `ingestedAt` |
| `CommitteeSpeaker` | `ingestion/committees/types.ts` | 6 | `name`, `latestAffiliation`, `latestParty`, `totalAppearances`, `firstSeen`, `lastSeen` |
| `InCameraAlert` | `ingestion/committees/types.ts` | 11 | `meetingId`, `committee`, `committeeName`, `chamber`, `parliament`, `session`, `meetingNumber`, `date`, `startTime`, `endTime`, `note` |
| `Intervention` | `ingestion/committees/types.ts` | 11 | `meetingId`, `sequence`, `speakerName`, `speakerAffiliation`, `speakerParty`, `speakerRole`, `interventionType`, `language`, `text`, `timestamp`, `paraTextIds` |
| `RawBusinessContent` | `ingestion/committees/types.ts` | 3 | — |
| `RawHansard` | `ingestion/committees/types.ts` | 1 | `Hansard` |
| `RawIntervention` | `ingestion/committees/types.ts` | 2 | — |
| `RawSubjectOfBusiness` | `ingestion/committees/types.ts` | 1 | — |
| `CorporateFiling` | `ingestion/corporate-filings/types.ts` | 10 | `id`, `corporationName`, `corporationNumber`, `status`, `incorporationDate`, `jurisdiction`, `source`, `category` |
| `CorporateFilingsIngestionResult` | `ingestion/corporate-filings/types.ts` | 4 | `records`, `totalFetched`, `errors`, `durationMs` |
| `GSINCategory` | `ingestion/corporate/constants.ts` | 2 | `code`, `description` |
| `TrackedExecutive` | `ingestion/corporate/constants.ts` | 5 | `name`, `organization`, `organizationTicker`, `title`, `category` |
| `RawCorporateSearchResult` | `ingestion/corporate/corporations.ts` | 10 | `corporationNumber`, `legalName`, `operatingNames`, `jurisdiction`, `status`, `corporationType`, `incorporationDate`, `officeAddress`, `lastAnnualReturn`, `sourceUrl` |
| `LobbyingSpike` | `ingestion/corporate/flags.ts` | 7 | `subject`, `currentCount`, `baselineAvg`, `spikeFactor`, `timeframe`, `topOrganizations`, `relatedCommittee` |
| `ExecutiveStory` | `ingestion/corporate/pipeline.ts` | 8 | `topic`, `executive`, `company`, `date`, `summary`, `sourceUrl`, `statements`, `relatedCommittees` |
| `DisclosureContract` | `ingestion/corporate/procurement.ts` | 14 | `id`, `vendorName`, `contractValue`, `awardDate`, `startDate`, `endDate`, `description`, `department`, `procurementMethod`, `tradeAgreement`, `bidsReceived`, `isSoleSource`, `sourceUrl`, `ingestedAt` |
| `MappedDisclosureRecord` | `ingestion/corporate/procurement.ts` | 12 | `reference`, `vendorName`, `contractValue`, `awardDate`, `startDate`, `endDate`, `description`, `department`, `procurementMethod`, `tradeAgreement`, `bidsReceived`, `isSoleSource` |
| `TenderNotice` | `ingestion/corporate/procurement.ts` | 12 | `id`, `title`, `description`, `publicationDate`, `closingDate`, `organization`, `procurementMethod`, `estimatedValue`, `tradeAgreement`, `gsin`, `url`, `status` |
| `PressRelease` | `ingestion/corporate/statements.ts` | 7 | `id`, `title`, `body`, `date`, `organization`, `url`, `source` |
| `ContractAward` | `ingestion/corporate/types.ts` | 18 | `id`, `vendorName`, `vendorAddress`, `contractValue`, `currency`, `awardDate`, `startDate`, `endDate`, `description`, `department`, `departmentAcronym`, `procurementMethod`, `gsin`, `tradeAgreement`, `bidsReceived`, `sourceUrl`, `isSoleSource`, `ingestedAt` |
| `ContractFlag` | `ingestion/corporate/types.ts` | 8 | `type`, `severity`, `contractId`, `title`, `organization`, `value`, `reason`, `sourceUrl` |
| `CorporateEntity` | `ingestion/corporate/types.ts` | 11 | `corporationNumber`, `legalName`, `operatingNames`, `jurisdiction`, `status`, `incorporationDate`, `officeAddress`, `directors`, `lastAnnualReturn`, `sourceUrl`, `ingestedAt` |
| `CorporateIngestionResult` | `ingestion/corporate/types.ts` | 8 | `source`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `ExecutiveStatement` | `ingestion/corporate/types.ts` | 15 | `id`, `executiveName`, `executiveTitle`, `organization`, `organizationTicker`, `statementType`, `date`, `title`, `text`, `excerpt`, `sourceUrl`, `topics`, `isCommitteeAppearance`, `committeeMeetingId`, `ingestedAt` |
| `InsiderTransaction` | `ingestion/corporate/types.ts` | 16 | `id`, `insiderName`, `insiderRelation`, `issuerName`, `issuerTicker`, `transactionDate`, `filingDate`, `transactionType`, `securityType`, `numberOfUnits`, `unitPrice`, `totalValue`, `currency`, `ownershipAfter`, `sourceUrl`, `ingestedAt` |
| `LobbyingRecord` | `ingestion/corporate/types.ts` | 16 | `id`, `registrantName`, `registrantClient`, `registrantAddress`, `clientName`, `clientBusiness`, `subjectMatter`, `governmentInstitution`, `publicOfficeHolder`, `communicationDate`, `startDate`, `endDate`, `lobbyingCostCad`, `lobbyistType`, `sourceUrl`, `ingestedAt` |
| `CkanPackageResponse` | `ingestion/cra-charity/fetcher.ts` | 5 | `id`, `title`, `notes`, `resources`, `organization` |
| `CkanResource` | `ingestion/cra-charity/fetcher.ts` | 7 | `id`, `name`, `description`, `format`, `url`, `created`, `last_modified` |
| `CraCharityResources` | `ingestion/cra-charity/fetcher.ts` | 6 | `packageId`, `year`, `identResource`, `financialResource`, `generalInfoResource`, `programsResource` |
| `CraCsvData` | `ingestion/cra-charity/parser.ts` | 4 | `identCsv`, `financialCsv`, `generalCsv`, `programsCsv` |
| `CraCharityIngestionResult` | `ingestion/cra-charity/types.ts` | 5 | `datasetYear`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `CraCharityT3010` | `ingestion/cra-charity/types.ts` | 20 | `id`, `bn`, `legalName`, `operatingName`, `category`, `designation`, `status`, `fiscalYearStart`, `fiscalYearEnd`, `totalRevenue`, `totalExpenses`, `totalAssets`, `totalLiabilities`, `compensationKeyEmployees`, `charitableProgramsDescription`, `politicalActivitiesAmount`, `grantsAmount`, `datasetYear`, `sourceUrl`, `ingestedAt` |
| `CriminalJusticeIngestionResult` | `ingestion/criminal-justice/types.ts` | 5 | `source`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `CscCostPerInmate` | `ingestion/criminal-justice/types.ts` | 6 | `id`, `fiscalYear`, `institutionType`, `costPerInmate`, `sourceUrl`, `ingestedAt` |
| `CscDeathInCustody` | `ingestion/criminal-justice/types.ts` | 9 | `id`, `fiscalYear`, `causeOfDeath`, `gender`, `ageRange`, `ethnicity`, `count`, `sourceUrl`, `ingestedAt` |
| `CscIncident` | `ingestion/criminal-justice/types.ts` | 8 | `id`, `fiscalYear`, `institution`, `region`, `incidentType`, `count`, `sourceUrl`, `ingestedAt` |
| `CscPopulation` | `ingestion/criminal-justice/types.ts` | 10 | `id`, `fiscalYear`, `institution`, `region`, `count`, `populationType`, `gender`, `securityLevel`, `sourceUrl`, `ingestedAt` |
| `LegalAidCaseCost` | `ingestion/criminal-justice/types.ts` | 9 | `id`, `fiscalYear`, `provinceTerritory`, `caseType`, `totalCost`, `caseCount`, `averageCostPerCase`, `sourceUrl`, `ingestedAt` |
| `LegalAidFunding` | `ingestion/criminal-justice/types.ts` | 7 | `id`, `fiscalYear`, `provinceTerritory`, `fundingSource`, `amount`, `sourceUrl`, `ingestedAt` |
| `ParoleDecision` | `ingestion/criminal-justice/types.ts` | 11 | `id`, `fiscalYear`, `paroleType`, `offenceCategory`, `region`, `totalDecisions`, `granted`, `denied`, `grantRate`, `sourceUrl`, `ingestedAt` |
| `PpscCaseload` | `ingestion/criminal-justice/types.ts` | 7 | `id`, `fiscalYear`, `caseloadType`, `courtLevel`, `fileCount`, `sourceUrl`, `ingestedAt` |
| `PpscOutcome` | `ingestion/criminal-justice/types.ts` | 7 | `id`, `fiscalYear`, `courtLevel`, `outcomeType`, `count`, `sourceUrl`, `ingestedAt` |
| `PpscStayRate` | `ingestion/criminal-justice/types.ts` | 8 | `id`, `fiscalYear`, `courtLevel`, `totalCompleted`, `totalStays`, `stayRate`, `sourceUrl`, `ingestedAt` |
| `RcmpCrimeSeverity` | `ingestion/criminal-justice/types.ts` | 8 | `id`, `year`, `jurisdiction`, `csiValue`, `violentCsi`, `nonViolentCsi`, `sourceUrl`, `ingestedAt` |
| `RcmpHateCrime` | `ingestion/criminal-justice/types.ts` | 8 | `id`, `year`, `jurisdiction`, `motivationType`, `incidents`, `clearanceRate`, `sourceUrl`, `ingestedAt` |
| `RcmpOrganizedCrime` | `ingestion/criminal-justice/types.ts` | 7 | `id`, `year`, `jurisdiction`, `crimeType`, `incidents`, `sourceUrl`, `ingestedAt` |
| `YouthJusticeCase` | `ingestion/criminal-justice/types.ts` | 9 | `id`, `fiscalYear`, `provinceTerritory`, `caseType`, `count`, `gender`, `ageGroup`, `sourceUrl`, `ingestedAt` |
| `YouthRecidivism` | `ingestion/criminal-justice/types.ts` | 9 | `id`, `fiscalYear`, `provinceTerritory`, `followUpPeriod`, `recidivismRate`, `totalTracked`, `reOffended`, `sourceUrl`, `ingestedAt` |
| `TrustScore` | `ingestion/cross-reference/trust-scoring.ts` | 8 | `overall`, `sourceAuthority`, `recencyScore`, `consistencyScore`, `nSourceConfidence`, `minSourcesRequired`, `passedThreshold`, `citationHash` |
| `CrossReferenceMatch` | `ingestion/cross-reference/types.ts` | 8 | `module`, `sourceUrl`, `date`, `title`, `description`, `relevance` |
| `CrossReferenceQuery` | `ingestion/cross-reference/types.ts` | 6 | `query` |
| `CrossReferenceResult` | `ingestion/cross-reference/types.ts` | 7 | `entity`, `entityType`, `matches`, `totalMatches`, `timeline`, `trustScore`, `ingestedAt` |
| `CrossReferenceTimelineEntry` | `ingestion/cross-reference/types.ts` | 4 | `date`, `module`, `event`, `sourceUrl` |
| `CrownCorporationConfig` | `ingestion/crown-corporations/types.ts` | 14 | `code`, `name`, `shortName`, `homepageUrl`, `annualReportsUrl`, `quarterlyReportsUrl`, `corporatePlanUrl`, `boardMinutesUrl`, `executiveCompUrl`, `rssFeedUrl`, `isCurrent`, `sector`, `currency` |
| `CrownCorporationIngestionOptions` | `ingestion/crown-corporations/types.ts` | 9 | — |
| `CrownCorporationIngestionResult` | `ingestion/crown-corporations/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perOrg`, `durationMs` |
| `CrownCorporationRecord` | `ingestion/crown-corporations/types.ts` | 25 | `id`, `org`, `orgName`, `reportType`, `fiscalYear`, `fiscalQuarter`, `title`, `summary`, `revenue`, `expenses`, `netIncome`, `governmentFunding`, `totalAssets`, `totalLiabilities`, `employeeCount`, `executiveCompensation`, `boardMembers`, `boardChair`, `ceoName`, `reportUrl`, `publishedDate`, `language`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `CrtcDecision` | `ingestion/crtc/types.ts` | 21 | `id`, `decisionNumber`, `title`, `date`, `type`, `applicant`, `outcome`, `subjectMatter`, `relatedCompanies`, `conditions`, `findings`, `isOwnershipChange`, `isNetNeutrality`, `isTelecomPricing`, `isCanadianContent`, `isLicenceRenewal`, `summary`, `sourceUrl`, `pdfUrl`, `language`, `ingestedAt` |
| `CrtcIngestionResult` | `ingestion/crtc/types.ts` | 7 | `decisionsFound`, `decisionsIngested`, `ownershipRecordsFound`, `ownershipRecordsIngested`, `sourcesTried`, `errors`, `durationMs` |
| `CrtcOwnershipRecord` | `ingestion/crtc/types.ts` | 15 | `id`, `recordType`, `undertakingName`, `undertakingType`, `serviceArea`, `licenceNumber`, `ownerName`, `parentCompany`, `ownershipPercentage`, `effectiveDate`, `publishedDate`, `transactionValue`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawCrtcDecisionItem` | `ingestion/crtc/types.ts` | 7 | `title`, `date`, `url`, `summary`, `rawType`, `decisionNumber`, `bodyHtml` |
| `RawCrtcOwnershipItem` | `ingestion/crtc/types.ts` | 12 | `undertakingName`, `undertakingType`, `serviceArea`, `licenceNumber`, `ownerName`, `parentCompany`, `ownershipPercentage`, `effectiveDate`, `publishedDate`, `transactionValue`, `sourceUrl`, `bodyHtml` |
| `RawCrtcPage` | `ingestion/crtc/types.ts` | 2 | `url`, `html` |
| `CmfProductionData` | `ingestion/culture/types.ts` | 8 | `projectId`, `title`, `company`, `category`, `year`, `amount`, `hashtag`, `url` |
| `CultureGrant` | `ingestion/culture/types.ts` | 9 | `program`, `recipient`, `province`, `amount`, `year`, `description`, `url`, `hash`, `ingestedAt` |
| `CultureIngestionResult` | `ingestion/culture/types.ts` | 3 | `records`, `errors`, `durationMs` |
| `CultureRecord` | `ingestion/culture/types.ts` | 13 | `id`, `year`, `category`, `value`, `description`, `region`, `sourceUrl`, `sourceName`, `ingestedAt` |
| `CultureSource` | `ingestion/culture/types.ts` | 4 | `name`, `baseUrl`, `description` |
| `NfbProductionRecord` | `ingestion/culture/types.ts` | 7 | `title`, `director`, `year`, `genre`, `format`, `duration`, `url` |
| `DefenceIngestionResult` | `ingestion/defence/types.ts` | 4 | `source`, `recordsIngested`, `errors`, `durationMs` |
| `DndPersonnelRecord` | `ingestion/defence/types.ts` | 6 | `year`, `month`, `rank`, `component`, `count` |
| `DndProcurementRecord` | `ingestion/defence/types.ts` | 5 | `year`, `vendor`, `description`, `value` |
| `ApprenticeshipRecord` | `ingestion/education-research/types.ts` | 10 | `id`, `fiscalYear`, `province`, `tradeGroup`, `tradeName`, `registrations`, `completions`, `activeApprentices`, `sourceUrl`, `ingestedAt` |
| `CFIInfrastructure` | `ingestion/education-research/types.ts` | 11 | `id`, `institution`, `projectTitle`, `programName`, `fundingAmount`, `currency`, `infrastructureSector`, `province`, `awardDate`, `sourceUrl`, `ingestedAt` |
| `EduIngestionResult` | `ingestion/education-research/types.ts` | 6 | `source`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `ResearchChair` | `ingestion/education-research/types.ts` | 10 | `id`, `chairholderName`, `institution`, `tier`, `discipline`, `program`, `startDate`, `awardDate`, `sourceUrl`, `ingestedAt` |
| `StudentLoan` | `ingestion/education-research/types.ts` | 12 | `id`, `institution`, `province`, `programYear`, `defaultRate`, `borrowersCount`, `totalDebt`, `averageDebt`, `repaymentRate`, `dataType`, `sourceUrl`, `ingestedAt` |
| `TriCouncilGrant` | `ingestion/education-research/types.ts` | 12 | `id`, `agency`, `programName`, `fiscalYear`, `recipientName`, `recipientInstitution`, `grantAmount`, `currency`, `projectTitle`, `projectSummary`, `sourceUrl`, `ingestedAt` |
| `UniversityTuition` | `ingestion/education-research/types.ts` | 12 | `id`, `institution`, `province`, `academicYear`, `studyLevel`, `program`, `tuitionFee`, `additionalFees`, `totalFee`, `studentCategory`, `sourceUrl`, `ingestedAt` |
| `ElectionPeriod` | `ingestion/elections/types.ts` | 4 | `type`, `electionName`, `startDate`, `endDate` |
| `ElectionsIngestionResult` | `ingestion/elections/types.ts` | 7 | `source`, `recordsFound`, `recordsIngested`, `categoriesFound`, `totalSpending`, `errors`, `durationMs` |
| `RawThirdPartyRecord` | `ingestion/elections/types.ts` | 23 | — |
| `RawThirdPartySpendingRecord` | `ingestion/elections/types.ts` | 12 | — |
| `ThirdPartyAd` | `ingestion/elections/types.ts` | 27 | `id`, `registrantName`, `registrantType`, `address`, `city`, `province`, `postalCode`, `telephone`, `officerName`, `officerTitle`, `targetedRidings`, `issueFocus`, `platforms`, `electionPeriod`, `totalSpending`, `spendingLimit`, `registrationNumber`, `registrationDate`, `isTrackedInfluenceActor`, `influenceActorId`, `isTrackedCorporateEntity`, `corporateEntityNumber`, `sourceUrl`, `sourceSystem`, `ckanPackageId`, `ckanResourceId`, `ingestedAt` |
| `ThirdPartySpending` | `ingestion/elections/types.ts` | 13 | `id`, `thirdPartyAdId`, `registrantName`, `reportingPeriod`, `platform`, `amount`, `spendingCategory`, `vendorName`, `targetedRiding`, `expenseDate`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `DisasterCsvRow` | `ingestion/emergency-management/parser.ts` | 5 | `disasterType`, `location`, `eventDate`, `estimatedCost`, `fatalities` |
| `EmergencyManagementIngestionOptions` | `ingestion/emergency-management/types.ts` | 4 | — |
| `EmergencyManagementIngestionResult` | `ingestion/emergency-management/types.ts` | 5 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `durationMs` |
| `EmergencyManagementRecord` | `ingestion/emergency-management/types.ts` | 13 | `id`, `sourceSystem`, `recordType`, `title`, `description`, `url`, `publishedAt`, `ingestedAt` |
| `RawEmergencyManagementRecord` | `ingestion/emergency-management/types.ts` | 5 | — |
| `ElectricityGenerationRecord` | `ingestion/energy/parser.ts` | 10 | `id`, `province`, `fuelType`, `generationMW`, `generationUnit`, `period`, `periodType`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `GasStorageRecord` | `ingestion/energy/parser.ts` | 11 | `id`, `province`, `facility`, `storageVolume`, `storageUnit`, `price`, `priceUnit`, `date`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `OilProductionRecord` | `ingestion/energy/parser.ts` | 12 | `id`, `province`, `product`, `volume`, `volumeUnit`, `value`, `valueUnit`, `period`, `periodType`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RenewableEnergyRecord` | `ingestion/energy/parser.ts` | 9 | `id`, `province`, `energyType`, `capacity`, `capacityUnit`, `period`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `BaseEnergyRecord` | `ingestion/energy/types.ts` | 7 | `id`, `title`, `description`, `url`, `date`, `sector`, `category` |
| `ElectricityRecord` | `ingestion/energy/types.ts` | 4 | — |
| `EnergyIngestionResult` | `ingestion/energy/types.ts` | 5 | `source`, `recordsFound`, `records`, `errors`, `durationMs` |
| `GasProductionRecord` | `ingestion/energy/types.ts` | 3 | — |
| `MiningRecord` | `ingestion/energy/types.ts` | 4 | — |
| `OilProductionRecord` | `ingestion/energy/types.ts` | 3 | — |
| `PipelineRecord` | `ingestion/energy/types.ts` | 4 | — |
| `RenewableEnergyRecord` | `ingestion/energy/types.ts` | 4 | — |
| `EntityResolutionServiceConfig` | `ingestion/entity-resolution-service.ts` | 1 | — |
| `ServiceMatchResult` | `ingestion/entity-resolution-service.ts` | 5 | `matched`, `score`, `aliases`, `input` |
| `MatchResult` | `ingestion/entity-resolver.ts` | 3 | `entity`, `input`, `matches` |
| `ResolvedEntity` | `ingestion/entity-resolver.ts` | 6 | `id`, `name`, `type`, `source`, `confidence`, `aliases` |
| `FaoIngestionResult` | `ingestion/fao-faostat/types.ts` | 4 | `success`, `records`, `errors`, `metadata` |
| `FaoRecord` | `ingestion/fao-faostat/types.ts` | 16 | `domain`, `domainCode`, `indicator`, `indicatorCode`, `area`, `areaCode`, `element`, `elementCode`, `item`, `itemCode`, `year`, `value`, `flag`, `flagDescription`, `id`, `timestamp` |
| `BudgetIngestionOptions` | `ingestion/federal-budget/types.ts` | 9 | — |
| `BudgetIngestionResult` | `ingestion/federal-budget/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perSource`, `durationMs` |
| `BudgetRecord` | `ingestion/federal-budget/types.ts` | 18 | `id`, `fiscalYear`, `recordType`, `department`, `departmentAcronym`, `category`, `amount`, `currency`, `description`, `title`, `publishedDate`, `fiscalQuarter`, `sourceUrl`, `sourceSystem`, `ckanPackageId`, `ckanResourceId`, `language`, `ingestedAt` |
| `CKANPackage` | `ingestion/federal-budget/types.ts` | 8 | `id`, `name`, `title`, `notes`, `organization`, `resources`, `metadata_created`, `metadata_modified` |
| `CKANPackageResponse` | `ingestion/federal-budget/types.ts` | 2 | `help`, `result` |
| `CKANResource` | `ingestion/federal-budget/types.ts` | 8 | `id`, `package_id`, `name`, `format`, `url`, `created`, `last_modified`, `size` |
| `RawDepartmentalPlanRow` | `ingestion/federal-budget/types.ts` | 3 | — |
| `RawFiscalMonitorRow` | `ingestion/federal-budget/types.ts` | 5 | — |
| `RawPublicAccountsRow` | `ingestion/federal-budget/types.ts` | 5 | — |
| `TribunalCase` | `ingestion/federal-tribunals/types.ts` | 8 | `id`, `tribunal`, `caseNumber`, `status`, `filedDate`, `subject`, `sourceUrl`, `ingestedAt` |
| `TribunalDecision` | `ingestion/federal-tribunals/types.ts` | 11 | `id`, `tribunal`, `caseNumber`, `title`, `applicant`, `respondent`, `decisionDate`, `outcome`, `summary`, `sourceUrl`, `ingestedAt` |
| `TribunalIngestionResult` | `ingestion/federal-tribunals/types.ts` | 3 | `decisions`, `cases`, `errors` |
| `FederalDataset` | `ingestion/federal/types.ts` | 9 | `agency`, `dataset`, `year`, `title`, `url`, `format`, `description`, `hash`, `ingestedAt` |
| `FederalDeepIngestionResult` | `ingestion/federal/types.ts` | 5 | `datasets`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `durationMs` |
| `BankingLobbyingMatch` | `ingestion/financial-regulation/cross-reference.ts` | 11 | `id`, `institutionName`, `totalComplaints`, `latestComplaintYear`, `lobbyingCount`, `lobbyingSubjects`, `latestLobbyingDate`, `riskSignal`, `lobbyingUrls`, `fcacUrls`, `analyzedAt` |
| `BankingLobbyingReport` | `ingestion/financial-regulation/cross-reference.ts` | 7 | `generatedAt`, `institutionsScanned`, `matchedInstitutions`, `matches`, `complaintsOnly`, `lobbyingOnly`, `errors` |
| `BankData` | `ingestion/financial-regulation/types.ts` | 10 | `id`, `institutionName`, `institutionType`, `jurisdiction`, `source`, `url`, `date` |
| `CDICMember` | `ingestion/financial-regulation/types.ts` | 8 | `id`, `institutionName`, `memberCategory`, `jurisdiction`, `source`, `url` |
| `Complaint` | `ingestion/financial-regulation/types.ts` | 9 | `id`, `institutionName`, `complaintType`, `count`, `year`, `category`, `jurisdiction`, `source`, `url` |
| `FinRegIngestionResult` | `ingestion/financial-regulation/types.ts` | 5 | `source`, `recordsFound`, `records`, `errors`, `durationMs` |
| `FinRegRecord` | `ingestion/financial-regulation/types.ts` | 8 | `id`, `regulator`, `title`, `description`, `url`, `date`, `category`, `jurisdiction` |
| `InsuranceData` | `ingestion/financial-regulation/types.ts` | 9 | `id`, `companyName`, `sector`, `jurisdiction`, `source`, `url`, `date` |
| `FireFetchResult` | `ingestion/fire-emergency/fetcher.ts` | 4 | `city`, `province`, `rawRecords` |
| `FireIncident` | `ingestion/fire-emergency/types.ts` | 7 | `id`, `city`, `province`, `date`, `incidentType` |
| `ResponseTime` | `ingestion/fire-emergency/types.ts` | 5 | `city`, `province`, `year`, `averageResponseTime`, `incidentType` |
| `Station` | `ingestion/fire-emergency/types.ts` | 7 | `id`, `city`, `province`, `name`, `address` |
| `FisheriesIngestionResult` | `ingestion/fisheries/types.ts` | 5 | `source`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `FisheriesRecord` | `ingestion/fisheries/types.ts` | 12 | `id`, `year`, `category`, `subCategory`, `value`, `unit`, `description`, `region`, `species`, `sourceUrl`, `sourceName`, `ingestedAt` |
| `FrenchSourceConfig` | `ingestion/french-sources/index.ts` | 11 | `id`, `name`, `nameEn`, `baseUrl`, `license`, `attributionText`, `updateFrequency`, `lang`, `category` |
| `FrenchSourceSearchResult` | `ingestion/french-sources/index.ts` | 8 | `source`, `title`, `url`, `lang`, `citation` |
| `GazetteIngestionResult` | `ingestion/gazette/types.ts` | 5 | `part`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `GazetteRecord` | `ingestion/gazette/types.ts` | 13 | `id`, `title`, `htmlUrl`, `part`, `publishedAt`, `description`, `registrationNumber`, `riasUrl`, `riasText`, `commentDeadline`, `department`, `regulationId`, `ingestedAt` |
| `LodeDatabaseInfo` | `ingestion/geospatial/lode/constants.ts` | 15 | `id`, `name`, `nameFr`, `version`, `releaseDate`, `description`, `csvUrl`, `geoUrl`, `serviceUrl`, `metadataUrl`, `ckanId`, `recordCount`, `frequency`, `formats`, `keywords` |
| `LodeAddress` | `ingestion/geospatial/lode/types.ts` | 13 | `id`, `civicNumber`, `streetName`, `streetType`, `municipality`, `provinceCode`, `postalCode`, `latitude`, `longitude`, `fullAddress`, `hash`, `sourceUrl`, `ingestedAt` |
| `LodeBuilding` | `ingestion/geospatial/lode/types.ts` | 18 | `id`, `buildingId`, `name`, `address`, `municipality`, `provinceCode`, `postalCode`, `latitude`, `longitude`, `buildingType`, `floors`, `yearBuilt`, `footprintAreaM2`, `sourceDataset`, `primaryUse`, `hash`, `sourceUrl`, `ingestedAt` |
| `LodeBusiness` | `ingestion/geospatial/lode/types.ts` | 15 | `id`, `name`, `naicsCode`, `naicsDescription`, `address`, `municipality`, `provinceCode`, `postalCode`, `latitude`, `longitude`, `employmentSize`, `revenueRange`, `hash`, `sourceUrl`, `ingestedAt` |
| `LodeCulturalFacility` | `ingestion/geospatial/lode/types.ts` | 12 | `id`, `name`, `facilityType`, `address`, `municipality`, `provinceCode`, `postalCode`, `latitude`, `longitude`, `hash`, `sourceUrl`, `ingestedAt` |
| `LodeCyclingNetwork` | `ingestion/geospatial/lode/types.ts` | 13 | `id`, `segmentId`, `canBicsClassification`, `lengthM`, `widthM`, `surfaceType`, `municipality`, `provinceCode`, `sourceMunicipality`, `protected`, `hash`, `sourceUrl`, `ingestedAt` |
| `LodeEducationalFacility` | `ingestion/geospatial/lode/types.ts` | 15 | `id`, `name`, `institutionType`, `address`, `municipality`, `provinceCode`, `postalCode`, `latitude`, `longitude`, `languageOfInstruction`, `gradeRange`, `schoolAuthority`, `hash`, `sourceUrl`, `ingestedAt` |
| `LodeGreenhouse` | `ingestion/geospatial/lode/types.ts` | 13 | `id`, `polygonId`, `areaM2`, `location`, `municipality`, `provinceCode`, `latitude`, `longitude`, `detectionMethod`, `version`, `hash`, `sourceUrl`, `ingestedAt` |
| `LodeHealthcareFacility` | `ingestion/geospatial/lode/types.ts` | 14 | `id`, `name`, `facilityType`, `address`, `municipality`, `provinceCode`, `postalCode`, `latitude`, `longitude`, `languageOfService`, `dataSource`, `hash`, `sourceUrl`, `ingestedAt` |
| `LodeInfrastructure` | `ingestion/geospatial/lode/types.ts` | 15 | `id`, `name`, `infraType`, `subType`, `location`, `municipality`, `provinceCode`, `latitude`, `longitude`, `status`, `yearBuilt`, `capacity`, `hash`, `sourceUrl`, `ingestedAt` |
| `LodeIngestionResult` | `ingestion/geospatial/lode/types.ts` | 6 | `source`, `databaseId`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `LodePedestrianNetwork` | `ingestion/geospatial/lode/types.ts` | 12 | `id`, `segmentId`, `pedestrianType`, `surfaceMaterial`, `widthM`, `lengthM`, `municipality`, `provinceCode`, `sourceMunicipality`, `hash`, `sourceUrl`, `ingestedAt` |
| `LodeRecreationalFacility` | `ingestion/geospatial/lode/types.ts` | 14 | `id`, `name`, `facilityType`, `address`, `municipality`, `provinceCode`, `postalCode`, `latitude`, `longitude`, `indoorOutdoor`, `iceSurface`, `hash`, `sourceUrl`, `ingestedAt` |
| `LodeSearchParams` | `ingestion/geospatial/lode/types.ts` | 7 | — |
| `LodeSearchResult` | `ingestion/geospatial/lode/types.ts` | 5 | `database`, `databaseId`, `records`, `total`, `durationMs` |
| `LodeTransitRoute` | `ingestion/geospatial/lode/types.ts` | 9 | `id`, `routeId`, `routeName`, `routeType`, `agencyName`, `municipality`, `hash`, `sourceUrl`, `ingestedAt` |
| `LodeTransitStop` | `ingestion/geospatial/lode/types.ts` | 14 | `id`, `stopId`, `stopName`, `stopType`, `latitude`, `longitude`, `municipality`, `provinceCode`, `agencyName`, `routesServed`, `wheelchairAccessible`, `hash`, `sourceUrl`, `ingestedAt` |
| `GeospatialIngestionResult` | `ingestion/geospatial/types.ts` | 5 | `records`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `durationMs` |
| `GeospatialRecord` | `ingestion/geospatial/types.ts` | 9 | `id`, `title`, `description`, `url`, `format`, `region`, `category`, `hash`, `ingestedAt` |
| `GICSourceConfig` | `ingestion/gic/constants.ts` | 5 | `name`, `description`, `baseUrl`, `priority` |
| `GICAppointment` | `ingestion/gic/types.ts` | 21 | `id`, `appointeeName`, `positionTitle`, `organization`, `organizationAcronym`, `category`, `department`, `appointmentDate`, `expiryDate`, `isRetroactive`, `salaryRange`, `salaryMin`, `salaryMax`, `location`, `predecessorName`, `orderInCouncilNumber`, `sourceUrl`, `sourceSystem`, `ckanPackageId`, `ckanResourceId`, `ingestedAt` |
| `GICIngestionResult` | `ingestion/gic/types.ts` | 7 | `source`, `recordsFound`, `recordsIngested`, `categoriesFound`, `highValueAppointments`, `errors`, `durationMs` |
| `RawGICRecord` | `ingestion/gic/types.ts` | 12 | — |
| `GlobalCanadaSourceConfig` | `ingestion/global-canada/constants.ts` | 5 | `label`, `sourceSystem`, `defaultRecordType`, `department`, `defaultLimit` |
| `CsisPublicationEntry` | `ingestion/global-canada/types.ts` | 6 | — |
| `GacTradeAgreementEntry` | `ingestion/global-canada/types.ts` | 7 | — |
| `GeoMetFeature` | `ingestion/global-canada/types.ts` | 3 | — |
| `GlobalCanadaIngestionOptions` | `ingestion/global-canada/types.ts` | 6 | — |
| `GlobalCanadaIngestionResult` | `ingestion/global-canada/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perSource`, `durationMs` |
| `GlobalCanadaRecord` | `ingestion/global-canada/types.ts` | 13 | `id`, `sourceSystem`, `recordType`, `title`, `date`, `description`, `url`, `department`, `topicArea`, `geographicFocus`, `referenceNumber`, `format`, `ingestedAt` |
| `RawGlobalCanadaRecord` | `ingestion/global-canada/types.ts` | 11 | — |
| `GoCContract` | `ingestion/goc-spending/types.ts` | 17 | `id`, `vendor`, `vendorNormalized`, `department`, `description`, `value`, `startYear`, `endYear`, `source`, `referenceNumber`, `contractDate`, `procurementMethod`, `tradeAgreementExemption`, `isDuplicate`, `isError`, `dataHash`, `ingestedAt` |
| `GoCDeptSpending` | `ingestion/goc-spending/types.ts` | 7 | `department`, `fiscalYear`, `contractCount`, `totalValue`, `avgValue`, `dataHash`, `ingestedAt` |
| `GoCIngestionResult` | `ingestion/goc-spending/types.ts` | 5 | `source`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `GoCVendorSpending` | `ingestion/goc-spending/types.ts` | 8 | `vendor`, `vendorNormalized`, `totalContracts`, `totalValue`, `firstYear`, `lastYear`, `dataHash`, `ingestedAt` |
| `CKANPackage` | `ingestion/gov-api.ts` | 7 | `id`, `title`, `notes`, `url`, `metadata_created`, `metadata_modified`, `organization` |
| `GovRelease` | `ingestion/gov-api.ts` | 7 | `source`, `title`, `description`, `release_date`, `data_url`, `jurisdiction`, `category` |
| `OpenDataPortalConfig` | `ingestion/gov-api.ts` | 2 | `baseUrl`, `apiType` |
| `OpenDataPortalDataset` | `ingestion/gov-api.ts` | 6 | `source`, `title`, `description`, `release_date`, `data_url`, `jurisdiction` |
| `StatCanRelease` | `ingestion/gov-api.ts` | 5 | `productId`, `title`, `summary`, `releaseDate`, `url` |
| `Agency` | `ingestion/gtfs-transit/constants.ts` | 5 | `id`, `name`, `province`, `url`, `type` |
| `GtfsFetchResult` | `ingestion/gtfs-transit/fetcher.ts` | 5 | `agencyId`, `agencyName`, `fetchUrl` |
| `GTFSAgency` | `ingestion/gtfs-transit/types.ts` | 6 | `id`, `name`, `province`, `url`, `type` |
| `GTFSCalendar` | `ingestion/gtfs-transit/types.ts` | 4 | `serviceId`, `startDate`, `endDate`, `days` |
| `GtfsIngestionResult` | `ingestion/gtfs-transit/types.ts` | 9 | `agencyId`, `agencyName`, `province`, `routes`, `stops`, `trips`, `calendars`, `errors`, `durationMs` |
| `GTFSRoute` | `ingestion/gtfs-transit/types.ts` | 6 | `routeId`, `agency`, `routeShortName`, `routeLongName`, `routeType` |
| `GTFSStop` | `ingestion/gtfs-transit/types.ts` | 5 | `stopId`, `stopName`, `stopLat`, `stopLon`, `agency` |
| `GTFSTrip` | `ingestion/gtfs-transit/types.ts` | 5 | `tripId`, `routeId`, `serviceId`, `direction`, `agency` |
| `HealthCanadaSourceConfig` | `ingestion/health-canada/constants.ts` | 4 | `label`, `apiUrl`, `sourceSystem`, `defaultLimit` |
| `DpdApiRecord` | `ingestion/health-canada/types.ts` | 11 | — |
| `HealthCanadaIngestionOptions` | `ingestion/health-canada/types.ts` | 5 | — |
| `HealthCanadaIngestionResult` | `ingestion/health-canada/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `HealthCanadaRecord` | `ingestion/health-canada/types.ts` | 21 | `id`, `productName`, `productType`, `licenseNumber`, `licenseStatus`, `manufacturer`, `therapeuticArea`, `activeIngredient`, `din`, `npn`, `licenseDate`, `expiryDate`, `recallSeverity`, `recallReason`, `recallClassification`, `dosageForm`, `routeOfAdministration`, `companyStatus`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `LnhpApiRecord` | `ingestion/health-canada/types.ts` | 9 | — |
| `MdallApiRecord` | `ingestion/health-canada/types.ts` | 6 | — |
| `RawHealthCanadaRecord` | `ingestion/health-canada/types.ts` | 19 | — |
| `RecallApiRecord` | `ingestion/health-canada/types.ts` | 5 | — |
| `CadthRecommendation` | `ingestion/health-data/types.ts` | 14 | `id`, `drug_name`, `brand_name`, `manufacturer`, `indication`, `recommendation`, `recommendation_type`, `review_type`, `submission_date`, `recommendation_date`, `reimbursement_condition`, `therapeutic_area`, `source_url`, `ingested_at` |
| `CfiaImportRefusal` | `ingestion/health-data/types.ts` | 13 | `id`, `refusal_date`, `country_of_origin`, `manufacturer`, `product_type`, `product_sub_type`, `product_name`, `reason`, `import_city`, `import_province`, `cfia_office`, `source_url`, `ingested_at` |
| `CfiaInspection` | `ingestion/health-data/types.ts` | 14 | `id`, `establishment_name`, `establishment_address`, `establishment_city`, `establishment_province`, `establishment_type`, `inspection_date`, `inspection_type`, `outcome`, `non_compliant`, `critical_violations`, `non_critical_violations`, `source_url`, `ingested_at` |
| `CfiaRecall` | `ingestion/health-data/types.ts` | 18 | `id`, `recall_id`, `title`, `brand`, `product_type`, `product_name`, `lot_number`, `upc`, `reason`, `hazard_classification`, `recall_status`, `classification`, `company`, `province_distribution`, `distribution`, `recall_date`, `source_url`, `ingested_at` |
| `CihiHealthSpending` | `ingestion/health-data/types.ts` | 10 | `id`, `fiscal_year`, `province`, `spending_category`, `amount_cad`, `per_capita`, `growth_percent`, `share_of_gdp`, `source_url`, `ingested_at` |
| `CihiWaitTime` | `ingestion/health-data/types.ts` | 12 | `id`, `year`, `province`, `surgery_type`, `procedure`, `wait_time_days`, `wait_time_p90_days`, `volume`, `priority`, `metric`, `source_url`, `ingested_at` |
| `DrugShortage` | `ingestion/health-data/types.ts` | 11 | `id`, `drug_name`, `din`, `company`, `shortage_reason`, `shortage_date`, `anticipated_end_date`, `status`, `therapeutic_area`, `source_url`, `ingested_at` |
| `HealthDataIngestionOptions` | `ingestion/health-data/types.ts` | 6 | — |
| `HealthDataIngestionResult` | `ingestion/health-data/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perSource`, `durationMs` |
| `LongTermCareInspection` | `ingestion/health-data/types.ts` | 13 | `id`, `province`, `facility_name`, `facility_type`, `inspection_date`, `inspection_type`, `overall_rating`, `total_deficiencies`, `critical_deficiencies`, `fines_amount_cad`, `resident_harm`, `source_url`, `ingested_at` |
| `PhacDiseaseSurveillance` | `ingestion/health-data/types.ts` | 13 | `id`, `disease`, `year`, `cases`, `cumulative_cases`, `province`, `age_group`, `sex`, `hospitalization`, `deaths`, `source_url`, `ingested_at` |
| `PhacImmunization` | `ingestion/health-data/types.ts` | 10 | `id`, `vaccine`, `year`, `age_group`, `coverage_percent`, `province`, `target_population`, `vaccinated`, `source_url`, `ingested_at` |
| `PhacOpioidDeath` | `ingestion/health-data/types.ts` | 15 | `id`, `year`, `province`, `opioid_type`, `deaths`, `rate_per_100k`, `apparent_opioid_toxicities`, `apparent_stimulant_toxicities`, `apparent_opioid_stimulant_toxicities`, `sex`, `age_group`, `source_url`, `ingested_at` |
| `PmprbPricing` | `ingestion/health-data/types.ts` | 15 | `id`, `drug_name`, `manufacturer`, `decision_type`, `decision_date`, `status`, `therapeutic_category`, `proposed_price_cad`, `approved_price_cad`, `foreign_price_comparison`, `comparison_countries`, `atc_class`, `din`, `source_url`, `ingested_at` |
| `HousingDataset` | `ingestion/housing-data/constants.ts` | 6 | `id`, `name`, `provider`, `url`, `category`, `coverage` |
| `HousingRecord` | `ingestion/housing-data/index.ts` | 6 | `id`, `name`, `provider`, `category`, `coverage`, `url` |
| `HousingCompletionRecord` | `ingestion/housing-data/types.ts` | 10 | `id`, `province`, `metroArea`, `housingType`, `completions`, `underConstruction`, `period`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `HousingDataIngestionOptions` | `ingestion/housing-data/types.ts` | 5 | — |
| `HousingDataIngestionResult` | `ingestion/housing-data/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perCategory`, `durationMs` |
| `HousingDataSearchOptions` | `ingestion/housing-data/types.ts` | 5 | — |
| `HousingMarketRecord` | `ingestion/housing-data/types.ts` | 12 | `id`, `category`, `metroArea`, `housingType`, `averagePrice`, `medianPrice`, `rentalRate`, `vacancyRate`, `period`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `HousingStartRecord` | `ingestion/housing-data/types.ts` | 9 | `id`, `province`, `metroArea`, `housingType`, `housingStarts`, `period`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawHousingCompletionRecord` | `ingestion/housing-data/types.ts` | 17 | — |
| `RawHousingMarketRecord` | `ingestion/housing-data/types.ts` | 24 | — |
| `RawHousingStartRecord` | `ingestion/housing-data/types.ts` | 17 | — |
| `IloIndicator` | `ingestion/ilo-labour/types.ts` | 5 | `id`, `name`, `topic`, `description`, `unit` |
| `IloIngestionResult` | `ingestion/ilo-labour/types.ts` | 5 | `datasetsAttempted`, `datasetsSucceeded`, `records`, `errors`, `durationMs` |
| `IloRecord` | `ingestion/ilo-labour/types.ts` | 9 | `id`, `indicatorCode`, `indicatorName`, `country`, `countryCode`, `year`, `value`, `unit`, `source` |
| `CbsaEnforcement` | `ingestion/immigration/types.ts` | 7 | `id`, `fiscalYear`, `actionType`, `count`, `description`, `sourceUrl`, `ingestedAt` |
| `CbsaPenalty` | `ingestion/immigration/types.ts` | 7 | `id`, `year`, `violationType`, `penaltyAmount`, `count`, `sourceUrl`, `ingestedAt` |
| `CitizenshipGrant` | `ingestion/immigration/types.ts` | 10 | `id`, `year`, `quarter`, `countryOfCitizenship`, `provinceTerritory`, `grants`, `ceremonies`, `processingTimeDays`, `sourceUrl`, `ingestedAt` |
| `ImmigrationIngestionResult` | `ingestion/immigration/types.ts` | 5 | `source`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `ImmigrationLobbyingLink` | `ingestion/immigration/types.ts` | 3 | `irccOfficial`, `title`, `lobbyingRecords` |
| `PermanentResidentAdmission` | `ingestion/immigration/types.ts` | 13 | `id`, `immigrationCategory`, `subCategory`, `provinceTerritory`, `countryOfCitizenship`, `year`, `month`, `count`, `gender`, `ageRange`, `sourceUrl`, `ckanDatasetId`, `ingestedAt` |
| `RefugeeDecision` | `ingestion/immigration/types.ts` | 13 | `id`, `decisionId`, `year`, `quarter`, `countryOfOrigin`, `language`, `outcome`, `represented`, `gender`, `ageGroup`, `hearingType`, `sourceUrl`, `ingestedAt` |
| `StudyPermitHolder` | `ingestion/immigration/types.ts` | 10 | `id`, `year`, `quarter`, `countryOfCitizenship`, `provinceTerritory`, `institution`, `studyLevel`, `count`, `sourceUrl`, `ingestedAt` |
| `TemporaryResidentVisa` | `ingestion/immigration/types.ts` | 11 | `id`, `year`, `quarter`, `visaCategory`, `countryOfCitizenship`, `visaOffice`, `applicationsReceived`, `applicationsApproved`, `approvalRate`, `sourceUrl`, `ingestedAt` |
| `WorkPermitHolder` | `ingestion/immigration/types.ts` | 10 | `id`, `year`, `quarter`, `programType`, `nocLevel`, `countryOfCitizenship`, `provinceTerritory`, `count`, `sourceUrl`, `ingestedAt` |
| `IaacIngestionOptions` | `ingestion/impact-assessment/types.ts` | 7 | — |
| `IaacIngestionResult` | `ingestion/impact-assessment/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perDecision`, `durationMs` |
| `ImpactAssessmentRecord` | `ingestion/impact-assessment/types.ts` | 17 | `id`, `projectName`, `proponent`, `projectType`, `location`, `province`, `decision`, `decisionDate`, `conditionsUrl`, `assessmentReportUrl`, `iaacReferenceNumber`, `ceaaReferenceNumber`, `assessmentType`, `federalProvincialAgreement`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawImpactAssessmentRecord` | `ingestion/impact-assessment/types.ts` | 15 | — |
| `TrackedCommunity` | `ingestion/indigenous-relations/constants.ts` | 4 | `name`, `provinceTerritory`, `fnpId`, `notes` |
| `TrcCallTemplate` | `ingestion/indigenous-relations/constants.ts` | 7 | `callNumber`, `category`, `subCategory`, `title`, `callText`, `responsibleEntity`, `iscInvolvement` |
| `D1Result` | `ingestion/indigenous-relations/types.ts` | 4 | `success` |
| `FnTransparencyRecord` | `ingestion/indigenous-relations/types.ts` | 11 | `id`, `communityName`, `fiscalYear`, `positionTitle`, `individualName`, `totalCompensation`, `baseSalary`, `taxableBenefits`, `isElected`, `sourceUrl`, `ingestedAt` |
| `IndigenousIngestionResult` | `ingestion/indigenous-relations/types.ts` | 5 | `source`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `IscCommunitySpending` | `ingestion/indigenous-relations/types.ts` | 11 | `id`, `fiscalYear`, `communityName`, `provinceTerritory`, `spendingCategory`, `programName`, `allocatedAmount`, `spentAmount`, `beneficiaries`, `sourceUrl`, `ingestedAt` |
| `LandClaim` | `ingestion/indigenous-relations/types.ts` | 14 | `id`, `claimType`, `claimant`, `provinceTerritory`, `description`, `status`, `submissionDate`, `settlementDate`, `settlementAmountCad`, `durationYears`, `negotiationStage`, `ckanDatasetId`, `sourceUrl`, `ingestedAt` |
| `SelfGovernmentAgreement` | `ingestion/indigenous-relations/types.ts` | 12 | `id`, `indigenousGroup`, `provinceTerritory`, `stage`, `agreementType`, `signingDate`, `effectiveDate`, `keyProvisions`, `jurisdictionAreas`, `isCirnacLed`, `sourceUrl`, `ingestedAt` |
| `TrcCallToAction` | `ingestion/indigenous-relations/types.ts` | 13 | `id`, `callNumber`, `category`, `subCategory`, `title`, `callText`, `status`, `assessmentDate`, `responsibleEntity`, `iscInvolvement`, `progressNotes`, `sourceUrl`, `ingestedAt` |
| `ServiceRecord` | `ingestion/indigenous-services-directory/types.ts` | 9 | `id`, `organization`, `name`, `province`, `trust_score`, `citation_hash` |
| `ServiceSearchOptions` | `ingestion/indigenous-services-directory/types.ts` | 3 | — |
| `ConnectionVerification` | `ingestion/influence/connections.ts` | 8 | `actorId`, `actorName`, `category`, `priority`, `verifiedConnections`, `pendingConnections`, `sourcesChecked`, `status` |
| `ActorPerson` | `ingestion/influence/types.ts` | 5 | `name`, `title`, `role`, `biography`, `alsoAt` |
| `CraCharityRecord` | `ingestion/influence/types.ts` | 13 | `bn`, `legalName`, `operatingNames`, `status`, `category`, `designation`, `totalRevenue`, `totalAssets`, `programs`, `directors`, `fiscalYearEnd`, `sourceUrl`, `ingestedAt` |
| `GovernmentFunding` | `ingestion/influence/types.ts` | 15 | `id`, `recipientName`, `recipientType`, `department`, `departmentAcronym`, `programName`, `agreementType`, `amount`, `currency`, `fiscalYear`, `startDate`, `endDate`, `description`, `sourceUrl`, `ingestedAt` |
| `InfluenceActor` | `ingestion/influence/types.ts` | 16 | `id`, `name`, `aliases`, `category`, `priority`, `headquarters`, `founded`, `annualBudgetCad`, `website`, `wikipediaUrl`, `isCraCharity`, `craBn`, `keyPeople`, `policyAreas`, `notes`, `ingestedAt` |
| `InfluenceConnection` | `ingestion/influence/types.ts` | 12 | `id`, `actorId`, `actorName`, `governmentEntity`, `connectionType`, `description`, `date`, `valueCad`, `sourceUrl`, `sourceSystem`, `sourceRecordId`, `ingestedAt` |
| `InfluenceIngestionResult` | `ingestion/influence/types.ts` | 8 | `actorsFound`, `connectionsFound`, `fundingFlowsFound`, `errors`, `durationMs` |
| `FamilySponsorship` | `ingestion/ircc-family-sponsorship/types.ts` | 6 | `id`, `sponsorCategory`, `province`, `processingTime`, `year`, `ingestedAt` |
| `IrccIngestionResult` | `ingestion/ircc-family-sponsorship/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `CitizenshipGrant` | `ingestion/ircc/citizenship/types.ts` | 6 | `id`, `year`, `province`, `demographic`, `count`, `ingestedAt` |
| `IrccIngestionResult` | `ingestion/ircc/citizenship/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `EntryExit` | `ingestion/ircc/entry-exit/types.ts` | 8 | `id`, `borderCrossing`, `modeOfTravel`, `nationality`, `entries`, `exits`, `quarter`, `ingestedAt` |
| `IrccIngestionResult` | `ingestion/ircc/entry-exit/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `ExpressEntryRound` | `ingestion/ircc/express-entry/types.ts` | 7 | `id`, `roundNumber`, `date`, `program`, `crsCutoff`, `invitationsSent`, `ingestedAt` |
| `IrccIngestionResult` | `ingestion/ircc/express-entry/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `IrccIngestionResult` | `ingestion/ircc/pr-admissions/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `PermanentResidentAdmission` | `ingestion/ircc/pr-admissions/types.ts` | 6 | `id`, `year`, `province`, `category`, `count`, `ingestedAt` |
| `IrccIngestionResult` | `ingestion/ircc/processing-times/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `ProcessingTime` | `ingestion/ircc/processing-times/types.ts` | 7 | `id`, `visaOffice`, `applicationType`, `processingTime`, `timeframe`, `lastUpdated`, `ingestedAt` |
| `IrccIngestionResult` | `ingestion/ircc/study-permits/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `StudyPermit` | `ingestion/ircc/study-permits/types.ts` | 7 | `id`, `institution`, `province`, `country`, `year`, `count`, `ingestedAt` |
| `IrccIngestionResult` | `ingestion/ircc/work-permits/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `WorkPermit` | `ingestion/ircc/work-permits/types.ts` | 7 | `id`, `nocCode`, `province`, `country`, `year`, `count`, `ingestedAt` |
| `IscIngestionResult` | `ingestion/isc-programs/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `SafetyProgram` | `ingestion/isc-programs/types.ts` | 6 | `id`, `program`, `community`, `funding`, `type`, `ingestedAt` |
| `FirstNationCommunity` | `ingestion/isc/communities/types.ts` | 8 | `id`, `name`, `province`, `bandNumber`, `population`, `tribalCouncil`, `services`, `ingestedAt` |
| `IscIngestionResult` | `ingestion/isc/communities/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `EducationFunding` | `ingestion/isc/education/types.ts` | 7 | `id`, `school`, `province`, `amount`, `studentCount`, `fiscalYear`, `ingestedAt` |
| `IscIngestionResult` | `ingestion/isc/education/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `IndigenousHealthFunding` | `ingestion/isc/health-funding/types.ts` | 6 | `id`, `program`, `community`, `amount`, `fiscalYear`, `ingestedAt` |
| `IscIngestionResult` | `ingestion/isc/health-funding/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `HousingProgram` | `ingestion/isc/housing/types.ts` | 7 | `id`, `program`, `community`, `units`, `funding`, `fiscalYear`, `ingestedAt` |
| `IscIngestionResult` | `ingestion/isc/housing/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `IscIngestionResult` | `ingestion/isc/jordan-principle/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `JordanPrincipleRequest` | `ingestion/isc/jordan-principle/types.ts` | 7 | `id`, `childId`, `serviceType`, `fundingAmount`, `status`, `decisionDate`, `ingestedAt` |
| `IscIngestionResult` | `ingestion/isc/land-claims/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `LandClaim` | `ingestion/isc/land-claims/types.ts` | 7 | `id`, `claimName`, `aboriginalGroup`, `province`, `signingDate`, `status`, `ingestedAt` |
| `IscIngestionResult` | `ingestion/isc/water/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `WaterInfrastructure` | `ingestion/isc/water/types.ts` | 8 | `id`, `community`, `systemType`, `status`, `treatmentType`, `lastInspection`, `advisoryType`, `ingestedAt` |
| `LegislationSourceConfig` | `ingestion/legislation/constants.ts` | 6 | `source`, `name`, `jurisdiction`, `url`, `type`, `enabled` |
| `LegislationIngestionResult` | `ingestion/legislation/types.ts` | 5 | `records`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `durationMs` |
| `LegislationRecord` | `ingestion/legislation/types.ts` | 11 | `source`, `jurisdiction`, `title`, `year`, `url`, `format`, `description`, `hash`, `ingestedAt` |
| `LibraryPortal` | `ingestion/library/constants.ts` | 6 | `city`, `province`, `url`, `portalType`, `datasetId`, `name` |
| `LibraryFetchResult` | `ingestion/library/fetcher.ts` | 4 | `city`, `library`, `rawData` |
| `LibraryIngestionResult` | `ingestion/library/types.ts` | 6 | `city`, `library`, `province`, `branches`, `errors`, `durationMs` |
| `LibraryRecord` | `ingestion/library/types.ts` | 12 | `id`, `city`, `province`, `library`, `branchName` |
| `CkanPackageResponse` | `ingestion/lmia/fetcher.ts` | 5 | `id`, `title`, `notes`, `resources`, `organization` |
| `CkanResource` | `ingestion/lmia/fetcher.ts` | 8 | `id`, `name`, `description`, `format`, `url`, `created`, `last_modified` |
| `LmiaIngestionResult` | `ingestion/lmia/types.ts` | 6 | `outcome`, `quarter`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `LmiaRecord` | `ingestion/lmia/types.ts` | 15 | `id`, `employer`, `city`, `province`, `outcome`, `stream`, `streamRaw`, `noc`, `nocTitle`, `positions`, `wageMin`, `wageMax`, `wageRate`, `quarter`, `ingestedAt` |
| `MediaSourceConfig` | `ingestion/media-broadcasting/constants.ts` | 5 | `source`, `name`, `url`, `description`, `enabled` |
| `MediaIngestionResult` | `ingestion/media-broadcasting/types.ts` | 5 | `records`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `durationMs` |
| `MediaRecord` | `ingestion/media-broadcasting/types.ts` | 10 | `source`, `title`, `url`, `year`, `description`, `hash`, `ingestedAt` |
| `MunicipalDataset` | `ingestion/municipal-long-tail/types.ts` | 9 | `id`, `municipality`, `province`, `title`, `url`, `format`, `category`, `hash`, `ingestedAt` |
| `MunicipalLongTailIngestionResult` | `ingestion/municipal-long-tail/types.ts` | 5 | `datasets`, `portalsChecked`, `datasetsFound`, `errors`, `durationMs` |
| `MunicipalPortal` | `ingestion/municipal/constants.ts` | 5 | `name`, `province`, `baseUrl`, `portalType`, `datasets` |
| `MunicipalIngestionResult` | `ingestion/municipal/types.ts` | 6 | `records`, `municipality`, `source`, `totalFetched`, `errors`, `durationMs` |
| `MunicipalRecord` | `ingestion/municipal/types.ts` | 15 | `id`, `municipality`, `municipalityId`, `province`, `dataset`, `title`, `url`, `format`, `lastModified`, `created`, `portalType` |
| `MunicipalSearchParams` | `ingestion/municipal/types.ts` | 5 | — |
| `NgoSourceFetch` | `ingestion/ngo-influence-rss/fetcher.ts` | 2 | `items`, `error` |
| `NgoRssConfig` | `ingestion/ngo-influence-rss/types.ts` | 6 | `name`, `url`, `category`, `description`, `enabled`, `narrativeTags` |
| `NgoRssIngestionResult` | `ingestion/ngo-influence-rss/types.ts` | 6 | `items`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `sources`, `durationMs` |
| `NgoRssItem` | `ingestion/ngo-influence-rss/types.ts` | 8 | `title`, `url`, `summary`, `publishedAt`, `source`, `category`, `narrativeTags`, `hash` |
| `NgoSourceOutcome` | `ingestion/ngo-influence-rss/types.ts` | 5 | `source`, `status`, `records`, `error` |
| `NotificationBridgeConfig` | `ingestion/notification-bridge.ts` | 3 | `apiBaseUrl` |
| `NpriIngestionOptions` | `ingestion/npri/types.ts` | 6 | — |
| `NpriIngestionResult` | `ingestion/npri/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perSubstance`, `durationMs` |
| `NpriRecord` | `ingestion/npri/types.ts` | 20 | `id`, `facilityName`, `facilityLocation`, `province`, `latitude`, `longitude`, `substanceName`, `substanceCas`, `releaseAirKg`, `releaseWaterKg`, `releaseLandKg`, `disposalKg`, `recyclingKg`, `fiscalYear`, `reportedBy`, `sourceUrl`, `ckanPackageId`, `ckanResourceId`, `sourceSystem`, `ingestedAt` |
| `RawNpriCkanPackage` | `ingestion/npri/types.ts` | 10 | `id`, `name`, `title`, `notes`, `organization`, `resources`, `metadata_created`, `metadata_modified` |
| `RawNpriRecord` | `ingestion/npri/types.ts` | 18 | — |
| `EnergyStat` | `ingestion/nrcan/energy/types.ts` | 7 | `id`, `source`, `province`, `year`, `value`, `unit`, `ingestedAt` |
| `NrcanIngestionResult` | `ingestion/nrcan/energy/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `ForestFire` | `ingestion/nrcan/fires/types.ts` | 9 | `id`, `location`, `province`, `year`, `hectares`, `cause`, `latitude`, `longitude`, `ingestedAt` |
| `NrcanIngestionResult` | `ingestion/nrcan/fires/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `ForestInventory` | `ingestion/nrcan/forests/types.ts` | 8 | `id`, `ecozone`, `species`, `biomass`, `carbon`, `area`, `year`, `ingestedAt` |
| `NrcanIngestionResult` | `ingestion/nrcan/forests/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `MineralProduction` | `ingestion/nrcan/minerals/types.ts` | 7 | `id`, `commodity`, `province`, `year`, `tonnes`, `value`, `ingestedAt` |
| `NrcanIngestionResult` | `ingestion/nrcan/minerals/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `NrcanIngestionResult` | `ingestion/nrcan/renewable/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `RenewableCapacity` | `ingestion/nrcan/renewable/types.ts` | 7 | `id`, `type`, `province`, `capacityMW`, `generationGWh`, `year`, `ingestedAt` |
| `MiningActivity` | `ingestion/nrcan/types.ts` | 6 | `id`, `project`, `province`, `stage`, `commodity`, `ingestedAt` |
| `NrcanIngestionResult` | `ingestion/nrcan/types.ts` | 5 | `dataset`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `TopographicMap` | `ingestion/nrcan/types.ts` | 6 | `id`, `ntsNumber`, `scale`, `edition`, `year`, `ingestedAt` |
| `NtOpenDataRecord` | `ingestion/nt-health-social/index.ts` | 2 | `title`, `url` |
| `NunavutDataset` | `ingestion/nu-bureau-statistics/index.ts` | 4 | `title`, `url`, `category`, `format` |
| `SnzDatasetMetadata` | `ingestion/nz-stats/types.ts` | 7 | `id`, `title` |
| `SnzFactRecord` | `ingestion/nz-stats/types.ts` | 7 | `id`, `dataset`, `datasetName`, `dimensions`, `value`, `period`, `lastUpdated` |
| `SnzIngestionResult` | `ingestion/nz-stats/types.ts` | 5 | `dataset`, `records`, `observationsExtracted`, `errors`, `durationMs` |
| `SnzODataEntity` | `ingestion/nz-stats/types.ts` | 1 | — |
| `OECDFetchResult` | `ingestion/oecd-stat/fetcher.ts` | 4 | `datasetId`, `datasetName`, `indicators` |
| `OECDDataset` | `ingestion/oecd-stat/types.ts` | 2 | `id`, `name` |
| `OECDIndicator` | `ingestion/oecd-stat/types.ts` | 8 | `id`, `datasetId`, `datasetName`, `indicatorCode`, `country`, `year`, `value`, `unit` |
| `OECDIngestionResult` | `ingestion/oecd-stat/types.ts` | 5 | `datasetsAttempted`, `datasetsSucceeded`, `indicators`, `errors`, `durationMs` |
| `OECDObservation` | `ingestion/oecd-stat/types.ts` | 4 | `country`, `year`, `value`, `unit` |
| `OECDSdmxResponse` | `ingestion/oecd-stat/types.ts` | 2 | — |
| `OecdCsvRow` | `ingestion/oecd/types.ts` | 2 | `Year`, `Value` |
| `OecdDataset` | `ingestion/oecd/types.ts` | 5 | `id`, `name`, `updateFrequency`, `csvUrlTemplate` |
| `OecdIngestionResult` | `ingestion/oecd/types.ts` | 5 | `datasetsAttempted`, `datasetsSucceeded`, `records`, `errors`, `durationMs` |
| `OecdRecord` | `ingestion/oecd/types.ts` | 11 | `id`, `datasetId`, `datasetName`, `country`, `topic`, `indicatorCode`, `indicatorName`, `year`, `value`, `unit` |
| `OecdTopic` | `ingestion/oecd/types.ts` | 4 | `code`, `name`, `datasets` |
| `OnCourtsIngestionOptions` | `ingestion/on-courts/types.ts` | 4 | — |
| `OnCourtsIngestionResult` | `ingestion/on-courts/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `OnCourtsRecord` | `ingestion/on-courts/types.ts` | 11 | `id`, `recordType`, `courtType`, `caseNumber`, `filingDate`, `caseType`, `location`, `status`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawOnCourtsRecord` | `ingestion/on-courts/types.ts` | 7 | — |
| `OnEconomicIngestionOptions` | `ingestion/on-economic/types.ts` | 4 | — |
| `OnEconomicIngestionResult` | `ingestion/on-economic/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `OnEconomicRecord` | `ingestion/on-economic/types.ts` | 14 | `id`, `recordType`, `category`, `subcategory`, `value`, `unit`, `period`, `fiscalYear`, `region`, `status`, `description`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawOnEconomicRecord` | `ingestion/on-economic/types.ts` | 10 | — |
| `OnEducationIngestionOptions` | `ingestion/on-education/types.ts` | 4 | — |
| `OnEducationIngestionResult` | `ingestion/on-education/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `OnEducationRecord` | `ingestion/on-education/types.ts` | 14 | `id`, `recordType`, `category`, `schoolBoard`, `schoolName`, `academicYear`, `grade`, `subject`, `result`, `studentCount`, `fundingAmount`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawOnEducationRecord` | `ingestion/on-education/types.ts` | 10 | — |
| `OntarioHealthSourceConfig` | `ingestion/on-health/constants.ts` | 4 | `label`, `apiUrl`, `sourceSystem`, `defaultLimit` |
| `OhipApiRecord` | `ingestion/on-health/types.ts` | 7 | — |
| `OntarioHealthIngestionOptions` | `ingestion/on-health/types.ts` | 7 | — |
| `OntarioHealthIngestionResult` | `ingestion/on-health/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `OntarioHealthRecord` | `ingestion/on-health/types.ts` | 17 | `id`, `recordType`, `claimType`, `serviceCode`, `feeSchedule`, `serviceDate`, `providerType`, `claimsCount`, `totalPaid`, `fiscalYear`, `title`, `topic`, `publicationDate`, `summary`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `PublicHealthApiRecord` | `ingestion/on-health/types.ts` | 8 | — |
| `RawOntarioHealthRecord` | `ingestion/on-health/types.ts` | 15 | — |
| `OnImmigrationIngestionOptions` | `ingestion/on-immigration/types.ts` | 4 | — |
| `OnImmigrationIngestionResult` | `ingestion/on-immigration/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `OnImmigrationRecord` | `ingestion/on-immigration/types.ts` | 11 | `id`, `recordType`, `stream`, `nominationsIssued`, `year`, `quarter`, `occupation`, `industry`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawOnImmigrationRecord` | `ingestion/on-immigration/types.ts` | 7 | — |
| `OnInfrastructureIngestionOptions` | `ingestion/on-infrastructure/types.ts` | 4 | — |
| `OnInfrastructureIngestionResult` | `ingestion/on-infrastructure/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `OnInfrastructureRecord` | `ingestion/on-infrastructure/types.ts` | 14 | `id`, `recordType`, `category`, `subcategory`, `value`, `unit`, `period`, `fiscalYear`, `region`, `status`, `description`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawOnInfrastructureRecord` | `ingestion/on-infrastructure/types.ts` | 10 | — |
| `OntarioCKANRecord` | `ingestion/ontario-provincial/types.ts` | 9 | `name`, `title`, `id`, `resources` |
| `OntarioCKANResource` | `ingestion/ontario-provincial/types.ts` | 11 | `name`, `url`, `id`, `package_id` |
| `OntarioProvincialResult` | `ingestion/ontario-provincial/types.ts` | 17 | `id`, `packageName`, `packageTitle`, `resourceName`, `resourceUrl`, `sourceSystem`, `ckanPackageId`, `ckanResourceId`, `ingestedAt` |
| `OCCompany` | `ingestion/opencorporates/types.ts` | 9 | `name`, `companyNumber`, `jurisdictionCode`, `url` |
| `OCFiling` | `ingestion/opencorporates/types.ts` | 4 | `title` |
| `OCOfficer` | `ingestion/opencorporates/types.ts` | 6 | `name`, `position` |
| `OCRelationship` | `ingestion/opencorporates/types.ts` | 5 | `type`, `companyName`, `companyNumber`, `jurisdictionCode` |
| `OCSearchResult` | `ingestion/opencorporates/types.ts` | 6 | `results`, `total`, `page`, `attribution`, `source`, `license` |
| `OversightBodyConfig` | `ingestion/oversight/constants.ts` | 7 | `body`, `nameEn`, `nameFr`, `baseUrl`, `reportsUrl`, `rssUrl`, `apiUrl` |
| `RSSChannelItem` | `ingestion/oversight/fetcher.ts` | 6 | `title`, `link`, `description`, `pubDate` |
| `CRTCDecision` | `ingestion/oversight/types.ts` | 16 | `id`, `body`, `title`, `date`, `url`, `summary`, `decisionType`, `decisionNumber`, `affectedParties`, `findings`, `conditions`, `isOwnershipChange`, `isNetNeutrality`, `isTelecomPricing`, `isBroadcastingContent`, `ingestedAt` |
| `Investigation` | `ingestion/oversight/types.ts` | 13 | `id`, `body`, `title`, `subject`, `dateOpened`, `dateClosed`, `summary`, `findings`, `recommendations`, `parties`, `outcome`, `url`, `ingestedAt` |
| `MergerReview` | `ingestion/oversight/types.ts` | 14 | `id`, `body`, `title`, `date`, `url`, `summary`, `parties`, `sector`, `outcome`, `conditions`, `antiCompetitiveConcerns`, `marketDefinition`, `findings`, `ingestedAt` |
| `OversightIngestionResult` | `ingestion/oversight/types.ts` | 6 | `body`, `reportsFound`, `reportsIngested`, `recommendationsFound`, `errors`, `durationMs` |
| `OversightReport` | `ingestion/oversight/types.ts` | 15 | `id`, `body`, `title`, `date`, `url`, `pdfUrl`, `reportType`, `summary`, `findings`, `recommendations`, `auditedEntities`, `fiscalYear`, `reportNumber`, `language`, `ingestedAt` |
| `RawCompetitionBureauItem` | `ingestion/oversight/types.ts` | 8 | `title`, `date`, `url`, `summary`, `body`, `cbType`, `companies`, `sectors` |
| `RawCRTCItem` | `ingestion/oversight/types.ts` | 7 | `title`, `date`, `url`, `summary`, `crtcType`, `affectedParties`, `decisionNumber` |
| `RawEthicsItem` | `ingestion/oversight/types.ts` | 8 | `title`, `date`, `url`, `bodyHtml`, `subject`, `outcome`, `parties`, `reportNumber` |
| `RawLobbyingItem` | `ingestion/oversight/types.ts` | 9 | `title`, `date`, `url`, `bodyHtml`, `subject`, `outcome`, `parties`, `actProvision`, `reportNumber` |
| `RawOAGItem` | `ingestion/oversight/types.ts` | 8 | `title`, `date`, `url`, `reportType`, `summary`, `pdfUrl`, `fiscalYear`, `auditedEntities` |
| `RawPBOItem` | `ingestion/oversight/types.ts` | 7 | `title`, `date`, `url`, `type`, `summary`, `pdfUrl`, `reportNumber` |
| `Recommendation` | `ingestion/oversight/types.ts` | 10 | `id`, `reportId`, `text`, `number`, `status`, `responsibleEntity`, `statusDate`, `targetDate`, `implementationNotes`, `ingestedAt` |
| `ParkPortal` | `ingestion/parks/constants.ts` | 6 | `city`, `province`, `url`, `portalType`, `datasetId`, `name` |
| `ParkFetchResult` | `ingestion/parks/fetcher.ts` | 3 | `city`, `rawData` |
| `ParkIngestionResult` | `ingestion/parks/types.ts` | 4 | `city`, `parks`, `errors`, `durationMs` |
| `ParkRecord` | `ingestion/parks/types.ts` | 11 | `id`, `city`, `province`, `parkName` |
| `VoteFetchResult` | `ingestion/parliamentary-voting/fetcher.ts` | 3 | `chamber`, `rawVotes` |
| `Division` | `ingestion/parliamentary-voting/types.ts` | 8 | `id`, `date`, `parliament`, `session`, `number` |
| `MPVote` | `ingestion/parliamentary-voting/types.ts` | 6 | `mpId`, `mpName`, `riding`, `party`, `divisionId`, `vote` |
| `VoteRecord` | `ingestion/parliamentary-voting/types.ts` | 8 | `id`, `chamber`, `voteNumber`, `date`, `title`, `yeas`, `nays`, `result` |
| `VoteSummary` | `ingestion/parliamentary-voting/types.ts` | 7 | `totalVotes`, `passed`, `failed`, `totalYeas`, `totalNays`, `averageYeas`, `averageNays` |
| `DrugShortageRow` | `ingestion/pharmaceuticals/parser.ts` | 5 | `drugName`, `manufacturer`, `shortageDate`, `shortageReason`, `status` |
| `PharmaceuticalsIngestionOptions` | `ingestion/pharmaceuticals/types.ts` | 4 | — |
| `PharmaceuticalsIngestionResult` | `ingestion/pharmaceuticals/types.ts` | 5 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `durationMs` |
| `PharmaceuticalsRecord` | `ingestion/pharmaceuticals/types.ts` | 13 | `id`, `sourceSystem`, `recordType`, `title`, `description`, `url`, `publishedAt`, `ingestedAt` |
| `RawPharmaceuticalsRecord` | `ingestion/pharmaceuticals/types.ts` | 5 | — |
| `PoliceAgency` | `ingestion/police-data/constants.ts` | 6 | `city`, `province`, `url`, `portalType`, `name`, `datasetId` |
| `PoliceFetchResult` | `ingestion/police-data/fetcher.ts` | 5 | `city`, `agency`, `province`, `rawData` |
| `CrimeStatistics` | `ingestion/police-data/types.ts` | 7 | `id`, `city`, `province`, `year`, `crimeType`, `count`, `ratePer100k` |
| `IncidentReport` | `ingestion/police-data/types.ts` | 7 | `id`, `city`, `province`, `date`, `incidentType` |
| `PoliceIngestionResult` | `ingestion/police-data/types.ts` | 5 | `city`, `agency`, `records`, `errors`, `durationMs` |
| `PoliceRecord` | `ingestion/police-data/types.ts` | 10 | `id`, `city`, `province`, `agency` |
| `RcmpCrimeRow` | `ingestion/policing-security/parser.ts` | 5 | `geo`, `violations`, `statistics`, `value`, `year` |
| `PolicingSecurityIngestionOptions` | `ingestion/policing-security/types.ts` | 4 | — |
| `PolicingSecurityIngestionResult` | `ingestion/policing-security/types.ts` | 5 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `durationMs` |
| `PolicingSecurityRecord` | `ingestion/policing-security/types.ts` | 13 | `id`, `sourceSystem`, `recordType`, `title`, `description`, `url`, `publishedAt`, `ingestedAt` |
| `RawPolicingSecurityRecord` | `ingestion/policing-security/types.ts` | 10 | — |
| `DonationFetchResult` | `ingestion/political-donations/fetcher.ts` | 4 | `jurisdiction`, `name`, `rawDonations` |
| `ContributionRecord` | `ingestion/political-donations/types.ts` | 7 | `id`, `jurisdiction`, `donor`, `amount` |
| `ContributionSummary` | `ingestion/political-donations/types.ts` | 5 | `totalContributions`, `totalAmount`, `averageAmount`, `maxAmount`, `minAmount` |
| `Donation` | `ingestion/political-donations/types.ts` | 8 | `id`, `jurisdiction`, `date`, `donorName`, `donorType`, `amount`, `recipient`, `recipientType` |
| `CKANSearchResponse` | `ingestion/proactive-disclosure/types.ts` | 2 | — |
| `DepartmentInfo` | `ingestion/proactive-disclosure/types.ts` | 4 | `nameEn`, `nameFr`, `acronym` |
| `ProactiveDisclosureIngestionResult` | `ingestion/proactive-disclosure/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `durationMs` |
| `ProactiveDisclosureRecord` | `ingestion/proactive-disclosure/types.ts` | 18 | `id`, `department`, `departmentAcronym`, `vendorName`, `contractValue`, `currency`, `awardDate`, `description`, `goodsOrServices`, `procurementMethod`, `contractPeriodStart`, `contractPeriodEnd`, `comments`, `sourceUrl`, `ckanPackageId`, `ckanResourceId`, `fiscalYear`, `ingestedAt` |
| `ProactiveDisclosureSearchOptions` | `ingestion/proactive-disclosure/types.ts` | 10 | — |
| `RawCKANProactiveDisclosureDoc` | `ingestion/proactive-disclosure/types.ts` | 51 | — |
| `ProvincialCkanSource` | `ingestion/provincial-ckan.ts` | 4 | `name`, `jurisdiction`, `endpoint`, `notes` |
| `BillEntry` | `ingestion/provincial-legislatures/fetcher.ts` | 5 | `number`, `title`, `status`, `date`, `url` |
| `CommitteeEntry` | `ingestion/provincial-legislatures/fetcher.ts` | 4 | `url`, `date`, `title`, `committeeName` |
| `TranscriptLink` | `ingestion/provincial-legislatures/fetcher.ts` | 3 | `url`, `date`, `title` |
| `ProvinceLegislatureConfig` | `ingestion/provincial-legislatures/types.ts` | 12 | `province`, `name`, `assemblyName`, `baseUrl`, `hansardUrl`, `committeesUrl`, `billsUrl`, `hasXmlHansard`, `hasCommitteeApi`, `hasBillsApi` |
| `ProvincialLegislatureIngestionOptions` | `ingestion/provincial-legislatures/types.ts` | 8 | — |
| `ProvincialLegislatureIngestionResult` | `ingestion/provincial-legislatures/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perProvince`, `durationMs` |
| `ProvincialLegislatureRecord` | `ingestion/provincial-legislatures/types.ts` | 26 | `id`, `province`, `recordType`, `chamber`, `sittingDate`, `hansardUrl`, `topic`, `speaker`, `party`, `riding`, `textExcerpt`, `billReference`, `billNumber`, `billTitle`, `billStatus`, `billDate`, `committeeName`, `meetingNumber`, `meetingStartTime`, `meetingEndTime`, `interventionCount`, `language`, `sourceUrl`, `sourceRecordId`, `sourceSystem`, `ingestedAt` |
| `ProvinceConfig` | `ingestion/provincial-lobbying/types.ts` | 7 | `code`, `name`, `commissioner`, `registryUrl`, `hasMonthlyCsv` |
| `ProvincialIngestionResult` | `ingestion/provincial-lobbying/types.ts` | 6 | `source`, `province`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `ProvincialLobbyingRecord` | `ingestion/provincial-lobbying/types.ts` | 4 | `id`, `province`, `originalId`, `sourceSystem` |
| `RawAlbertaRecord` | `ingestion/provincial-lobbying/types.ts` | 15 | — |
| `RawBCRecord` | `ingestion/provincial-lobbying/types.ts` | 15 | — |
| `RawManitobaRecord` | `ingestion/provincial-lobbying/types.ts` | 15 | — |
| `RawNewBrunswickRecord` | `ingestion/provincial-lobbying/types.ts` | 15 | — |
| `RawNewfoundlandRecord` | `ingestion/provincial-lobbying/types.ts` | 15 | — |
| `RawNovaScotiaRecord` | `ingestion/provincial-lobbying/types.ts` | 15 | — |
| `RawNunavutRecord` | `ingestion/provincial-lobbying/types.ts` | 15 | — |
| `RawNWTRecord` | `ingestion/provincial-lobbying/types.ts` | 15 | — |
| `RawOntarioRecord` | `ingestion/provincial-lobbying/types.ts` | 14 | — |
| `RawPEIRecord` | `ingestion/provincial-lobbying/types.ts` | 15 | — |
| `RawQuebecRecord` | `ingestion/provincial-lobbying/types.ts` | 15 | — |
| `RawSaskatchewanRecord` | `ingestion/provincial-lobbying/types.ts` | 15 | — |
| `RawYukonRecord` | `ingestion/provincial-lobbying/types.ts` | 15 | — |
| `ProvincialOrgConfig` | `ingestion/provincial-orgs/types.ts` | 10 | `code`, `name`, `province`, `bodyType`, `baseUrl`, `description`, `enabled` |
| `ProvincialOrgIngestionResult` | `ingestion/provincial-orgs/types.ts` | 5 | `records`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `durationMs` |
| `ProvincialOrgRecord` | `ingestion/provincial-orgs/types.ts` | 10 | `bodyCode`, `bodyName`, `bodyType`, `province`, `title`, `url`, `summary`, `publishedAt`, `hash`, `ingestedAt` |
| `RegulatorCategory` | `ingestion/provincial-regulators/constants.ts` | 4 | `code`, `name`, `searchTerms` |
| `ProvincialRegulatorRecord` | `ingestion/provincial-regulators/types.ts` | 8 | `id`, `province`, `regulator`, `decisionType`, `date`, `summary`, `sourceUrl`, `ingestedAt` |
| `ProvincialRegulatorsIngestionResult` | `ingestion/provincial-regulators/types.ts` | 4 | `records`, `errors` |
| `ProvincialDataset` | `ingestion/provincial/types.ts` | 8 | `province`, `sector`, `title`, `url`, `format`, `description`, `hash`, `ingestedAt` |
| `ProvincialDeepIngestionResult` | `ingestion/provincial/types.ts` | 5 | `datasets`, `portalsChecked`, `datasetsFound`, `errors`, `durationMs` |
| `PublicAccountsFetchResult` | `ingestion/public-accounts/fetcher.ts` | 4 | `level`, `name`, `rawRecords` |
| `AccountEntry` | `ingestion/public-accounts/types.ts` | 7 | `id`, `level`, `category`, `fiscalYear`, `amount`, `description`, `currency` |
| `AccountSummary` | `ingestion/public-accounts/types.ts` | 3 | `totalEntries`, `totalAmount`, `categories` |
| `DebtLiability` | `ingestion/public-accounts/types.ts` | 3 | `category`, `year`, `amount` |
| `DepartmentalStatement` | `ingestion/public-accounts/types.ts` | 5 | `department`, `year`, `revenue`, `expenses`, `netCost` |
| `ProgramSpending` | `ingestion/public-accounts/types.ts` | 5 | `department`, `program`, `year`, `actual`, `planned` |
| `QcCourtsIngestionOptions` | `ingestion/qc-courts/types.ts` | 4 | — |
| `QcCourtsIngestionResult` | `ingestion/qc-courts/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `QcCourtsRecord` | `ingestion/qc-courts/types.ts` | 11 | `id`, `recordType`, `courtType`, `fileNumber`, `filingDate`, `caseType`, `district`, `status`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawQcCourtsRecord` | `ingestion/qc-courts/types.ts` | 7 | — |
| `QcEconomicIngestionOptions` | `ingestion/qc-economic/types.ts` | 4 | — |
| `QcEconomicIngestionResult` | `ingestion/qc-economic/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `QcEconomicRecord` | `ingestion/qc-economic/types.ts` | 14 | `id`, `recordType`, `category`, `subcategory`, `value`, `unit`, `period`, `fiscalYear`, `region`, `status`, `description`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawQcEconomicRecord` | `ingestion/qc-economic/types.ts` | 10 | — |
| `QcEducationIngestionOptions` | `ingestion/qc-education/types.ts` | 4 | — |
| `QcEducationIngestionResult` | `ingestion/qc-education/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `QcEducationRecord` | `ingestion/qc-education/types.ts` | 14 | `id`, `recordType`, `category`, `schoolBoard`, `schoolName`, `academicYear`, `grade`, `subject`, `result`, `studentCount`, `fundingAmount`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawQcEducationRecord` | `ingestion/qc-education/types.ts` | 10 | — |
| `QCHealthSourceConfig` | `ingestion/qc-health/constants.ts` | 4 | `label`, `apiUrl`, `sourceSystem`, `defaultLimit` |
| `QCHealthIngestionOptions` | `ingestion/qc-health/types.ts` | 5 | — |
| `QCHealthIngestionResult` | `ingestion/qc-health/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `QCHealthRecord` | `ingestion/qc-health/types.ts` | 9 | `id`, `title`, `titleFr`, `topic`, `publicationDate`, `url`, `summary`, `sourceSystem`, `ingestedAt` |
| `RAMQRecord` | `ingestion/qc-health/types.ts` | 13 | `id`, `claimType`, `serviceCode`, `serviceDate`, `providerType`, `beneficiaryType`, `region`, `claimsCount`, `totalPaid`, `fiscalYear`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawQCHealthRecord` | `ingestion/qc-health/types.ts` | 6 | — |
| `RawRAMQRecord` | `ingestion/qc-health/types.ts` | 10 | — |
| `QCImmigrationSourceConfig` | `ingestion/qc-immigration/constants.ts` | 4 | `label`, `apiUrl`, `sourceSystem`, `defaultLimit` |
| `QcImmigrationIngestionOptions` | `ingestion/qc-immigration/types.ts` | 4 | — |
| `QcImmigrationIngestionResult` | `ingestion/qc-immigration/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `QcImmigrationRecord` | `ingestion/qc-immigration/types.ts` | 11 | `id`, `recordType`, `stream`, `nominationsIssued`, `year`, `quarter`, `countryOfOrigin`, `region`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawQcImmigrationRecord` | `ingestion/qc-immigration/types.ts` | 7 | — |
| `QcInfrastructureIngestionOptions` | `ingestion/qc-infrastructure/types.ts` | 4 | — |
| `QcInfrastructureIngestionResult` | `ingestion/qc-infrastructure/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perType`, `durationMs` |
| `QcInfrastructureRecord` | `ingestion/qc-infrastructure/types.ts` | 14 | `id`, `recordType`, `category`, `subcategory`, `value`, `unit`, `period`, `fiscalYear`, `region`, `status`, `description`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `RawQcInfrastructureRecord` | `ingestion/qc-infrastructure/types.ts` | 10 | — |
| `ParseAllRealEstateResult` | `ingestion/real-estate/parser.ts` | 7 | `rentalMarketData`, `housingStarts`, `housePriceIndex`, `propertyAssessment`, `totalRecords`, `totalErrors`, `totalDuplicates` |
| `ParseResult` | `ingestion/real-estate/parser.ts` | 3 | `records`, `errors`, `duplicateCount` |
| `ParserOptions` | `ingestion/real-estate/parser.ts` | 3 | `sourceUrl` |
| `RawCsvData` | `ingestion/real-estate/parser.ts` | 4 | — |
| `HousePriceIndex` | `ingestion/real-estate/types.ts` | 8 | `id`, `city`, `province`, `indexValue`, `changePercent`, `period`, `source`, `url` |
| `HousingStart` | `ingestion/real-estate/types.ts` | 9 | `id`, `municipality`, `province`, `starts`, `year`, `housingType`, `source`, `url` |
| `PropertyAssessment` | `ingestion/real-estate/types.ts` | 9 | `id`, `jurisdiction`, `province`, `assessedValue`, `year`, `propertyType`, `municipality` |
| `RealEstateIngestionResult` | `ingestion/real-estate/types.ts` | 5 | `source`, `recordsFound`, `records`, `errors`, `durationMs` |
| `RealEstateRecord` | `ingestion/real-estate/types.ts` | 7 | `id`, `title`, `description`, `url`, `date`, `sector`, `jurisdiction` |
| `RentalMarketData` | `ingestion/real-estate/types.ts` | 9 | `id`, `municipality`, `province`, `vacancyRate`, `averageRent`, `unitType`, `year`, `source`, `url` |
| `AmqpsSubscription` | `ingestion/real-time-feeds/amqps-subscriber.ts` | 1 | `close` |
| `RealtimeSourceConfig` | `ingestion/real-time-feeds/constants.ts` | 7 | `source`, `name`, `url`, `format`, `refreshSeconds`, `description`, `enabled` |
| `RealtimeIngestionResult` | `ingestion/real-time-feeds/types.ts` | 6 | `records`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `durationMs`, `sources` |
| `RealtimeRecord` | `ingestion/real-time-feeds/types.ts` | 9 | `source`, `title`, `url`, `publishedAt`, `summary`, `hash`, `ingestedAt` |
| `RegionalAuthorityConfig` | `ingestion/regional-authorities/types.ts` | 10 | `code`, `name`, `province`, `portalType`, `baseUrl`, `notes`, `datasets` |
| `RegionalIngestionResult` | `ingestion/regional-authorities/types.ts` | 5 | `records`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `durationMs` |
| `RegionalRecord` | `ingestion/regional-authorities/types.ts` | 8 | `authority`, `name`, `title`, `description`, `url`, `format`, `hash`, `ingestedAt` |
| `ModuleInfo` | `ingestion/registry.ts` | 10 | `name`, `description`, `category`, `modulePath`, `ingestFunctions`, `sources`, `updateFrequency` |
| `FetchOptions` | `ingestion/rss.ts` | 3 | — |
| `RawArticle` | `ingestion/rss.ts` | 7 | `title`, `summary`, `url`, `source`, `publishedAt`, `category` |
| `RSSFeed` | `ingestion/rss.ts` | 1 | — |
| `RSSItem` | `ingestion/rss.ts` | 6 | — |
| `RSSSource` | `ingestion/rss.ts` | 4 | `name`, `url`, `category` |
| `IngestRunRecord` | `ingestion/run-log.ts` | 10 | `id`, `pipeline`, `started_at`, `finished_at`, `status`, `records`, `claims`, `schedule`, `error`, `sources` |
| `RecordIngestRunInput` | `ingestion/run-log.ts` | 9 | `pipeline`, `startedAt`, `finishedAt`, `status` |
| `RunSources` | `ingestion/run-log.ts` | 2 | `sources`, `zeroReason` |
| `SourceOutcome` | `ingestion/run-log.ts` | 5 | `source`, `status`, `records`, `error` |
| `OceanObservation` | `ingestion/science-research/types.ts` | 12 | `id`, `station`, `region`, `latitude`, `longitude`, `parameter`, `value`, `unit`, `timestamp`, `depth`, `sourceUrl`, `ingestedAt` |
| `PolarRecord` | `ingestion/science-research/types.ts` | 11 | `id`, `title`, `investigator`, `organization`, `region`, `discipline`, `startYear`, `endYear`, `fundingAmount`, `sourceUrl`, `ingestedAt` |
| `ResearchGrant` | `ingestion/science-research/types.ts` | 12 | `id`, `agency`, `program`, `recipient`, `recipientType`, `amountCad`, `year`, `province`, `title`, `description`, `sourceUrl`, `ingestedAt` |
| `ScienceIngestionResult` | `ingestion/science-research/types.ts` | 5 | `grants`, `missions`, `observations`, `polar`, `errors` |
| `SpaceMission` | `ingestion/science-research/types.ts` | 9 | `id`, `mission`, `agency`, `status`, `launchYear`, `description`, `budgetCad`, `sourceUrl`, `ingestedAt` |
| `TrackedIssuer` | `ingestion/sedar-plus/constants.ts` | 4 | `name`, `ticker`, `exchange`, `sector` |
| `CdPlusApiResponse` | `ingestion/sedar-plus/types.ts` | 2 | `data`, `pagination` |
| `SedarFiling` | `ingestion/sedar-plus/types.ts` | 18 | `filingId`, `issuerId`, `issuerName`, `filingDate`, `periodEnd`, `filingType`, `filingTypeRaw`, `title`, `description`, `documentUrl`, `fileSizeBytes`, `fileFormat`, `language`, `jurisdiction`, `status`, `projectNumber`, `isLegacy`, `ingestedAt` |
| `SedarIngestionResult` | `ingestion/sedar-plus/types.ts` | 8 | `totalFound`, `totalFetched`, `totalUnique`, `totalNew`, `errors`, `durationMs` |
| `SedarIssuer` | `ingestion/sedar-plus/types.ts` | 7 | `issuerId`, `name`, `tickers`, `sector`, `jurisdiction`, `city`, `active` |
| `SedarSearchParams` | `ingestion/sedar-plus/types.ts` | 8 | — |
| `SedarSearchResult` | `ingestion/sedar-plus/types.ts` | 5 | `total`, `results`, `offset`, `limit`, `hasMore` |
| `MajorIssuer` | `ingestion/sedi/constants.ts` | 3 | `name`, `ticker`, `sector` |
| `RawSediRow` | `ingestion/sedi/types.ts` | 14 | `issuerName`, `issuerTicker`, `insiderName`, `relationship`, `transactionTypeRaw`, `securityType`, `volumeRaw`, `priceRaw`, `totalValueRaw`, `transactionDate`, `filingDate`, `closingDate`, `ownershipAfterRaw`, `natureOfOwnership` |
| `SediIngestionResult` | `ingestion/sedi/types.ts` | 7 | `rowsFound`, `rowsParsed`, `rowsIngested`, `errors`, `durationMs` |
| `SediSearchParams` | `ingestion/sedi/types.ts` | 4 | — |
| `CcbRecord` | `ingestion/social-programs/types.ts` | 10 | `id`, `period`, `region`, `regionType`, `families`, `children`, `totalPayments`, `averagePerFamily`, `sourceUrl`, `ingestedAt` |
| `CkanPackageResult` | `ingestion/social-programs/types.ts` | 4 | `id`, `title`, `notes`, `resources` |
| `CkanResource` | `ingestion/social-programs/types.ts` | 6 | `id`, `name`, `format`, `url`, `created`, `last_modified` |
| `CppibInvestment` | `ingestion/social-programs/types.ts` | 9 | `id`, `year`, `totalAssets`, `netReturn`, `return5yr`, `return10yr`, `assetAllocation`, `sourceUrl`, `ingestedAt` |
| `CppOasBeneficiary` | `ingestion/social-programs/types.ts` | 10 | `id`, `program`, `year`, `beneficiaries`, `province`, `gender`, `ageGroup`, `benefitsPaid`, `sourceUrl`, `ingestedAt` |
| `DisabilityBenefitRecord` | `ingestion/social-programs/types.ts` | 8 | `id`, `year`, `program`, `jurisdiction`, `monthlyBenefit`, `recipients`, `sourceUrl`, `ingestedAt` |
| `EiRecord` | `ingestion/social-programs/types.ts` | 10 | `id`, `period`, `province`, `category`, `value`, `rate`, `sex`, `ageGroup`, `sourceUrl`, `ingestedAt` |
| `FoodBankRecord` | `ingestion/social-programs/types.ts` | 10 | `id`, `year`, `province`, `visits`, `individuals`, `pctChildren`, `pctSeniors`, `pctEmployed`, `sourceUrl`, `ingestedAt` |
| `HomelessnessRecord` | `ingestion/social-programs/types.ts` | 12 | `id`, `year`, `community`, `province`, `totalHomeless`, `sheltered`, `unsheltered`, `pctIndigenous`, `youthCount`, `veteranCount`, `sourceUrl`, `ingestedAt` |
| `MbmThreshold` | `ingestion/social-programs/types.ts` | 8 | `id`, `year`, `province`, `communitySize`, `threshold2adult2child`, `thresholdSingle`, `sourceUrl`, `ingestedAt` |
| `PovertyRecord` | `ingestion/social-programs/types.ts` | 10 | `id`, `year`, `measure`, `province`, `populationGroup`, `rate`, `count`, `medianIncome`, `sourceUrl`, `ingestedAt` |
| `SocialAssistanceRecord` | `ingestion/social-programs/types.ts` | 10 | `id`, `year`, `province`, `program`, `householdType`, `monthlyBenefit`, `shelterAllowance`, `totalAssistance`, `sourceUrl`, `ingestedAt` |
| `SocialIngestionResult` | `ingestion/social-programs/types.ts` | 8 | `cppOas`, `cppib`, `ei`, `ccb`, `poverty`, `socialAssistance`, `foodSecurity`, `durationMs` |
| `SocrataSource` | `ingestion/socrata-api.ts` | 3 | `province`, `endpoint`, `label` |
| `SocrataView` | `ingestion/socrata-api.ts` | 9 | `id`, `name`, `description`, `type`, `category`, `createdAt`, `updatedAt`, `downloadCount`, `url` |
| `RawSaraSpecies` | `ingestion/species-at-risk/types.ts` | 11 | `id` |
| `SaraApiResponse` | `ingestion/species-at-risk/types.ts` | 5 | `data` |
| `SaraIngestionOptions` | `ingestion/species-at-risk/types.ts` | 6 | — |
| `SaraIngestionResult` | `ingestion/species-at-risk/types.ts` | 6 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `perStatus`, `durationMs` |
| `SpeciesAtRiskRecord` | `ingestion/species-at-risk/types.ts` | 14 | `id`, `speciesName`, `scientificName`, `taxonomicGroup`, `status`, `assessmentDate`, `listingDate`, `recoveryStrategyUrl`, `criticalHabitat`, `provinceTerritory`, `saraSpeciesId`, `sourceUrl`, `sourceSystem`, `ingestedAt` |
| `CpiRecord` | `ingestion/statcan/types.ts` | 5 | `indicatorType`, `cpiProduct`, `cpiCategory`, `province`, `city` |
| `GdpRecord` | `ingestion/statcan/types.ts` | 5 | `indicatorType`, `industry`, `naics`, `province`, `gdpType` |
| `HousingRecord` | `ingestion/statcan/types.ts` | 6 | `indicatorType`, `housingMetric`, `areaType`, `cma`, `housingType`, `province` |
| `JsonStatDimension` | `ingestion/statcan/types.ts` | 2 | `label`, `category` |
| `JsonStatResponse` | `ingestion/statcan/types.ts` | 11 | `version`, `class`, `label`, `id`, `size`, `dimension`, `value` |
| `JsonStatUnit` | `ingestion/statcan/types.ts` | 4 | `label` |
| `LabourRecord` | `ingestion/statcan/types.ts` | 8 | `indicatorType`, `labourCharacteristic`, `populationGroup`, `sex`, `industry`, `naics`, `province`, `dataType` |
| `PopulationRecord` | `ingestion/statcan/types.ts` | 5 | `indicatorType`, `ageGroup`, `sex`, `province`, `populationType` |
| `SocialRecord` | `ingestion/statcan/types.ts` | 6 | `indicatorType`, `socialCategory`, `indicatorName`, `demographic`, `geoLevel`, `province` |
| `StatCanAllIndicatorsResult` | `ingestion/statcan/types.ts` | 10 | `cpi`, `gdp`, `labour`, `population`, `trade`, `housing`, `social`, `totalRecords`, `totalErrors`, `durationMs` |
| `StatCanIngestionResult` | `ingestion/statcan/types.ts` | 6 | `indicatorType`, `productId`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `StatCanRecord` | `ingestion/statcan/types.ts` | 13 | `id`, `productId`, `indicatorType`, `value`, `period`, `date`, `geography`, `geoCode`, `unit`, `seasonalAdjustment`, `ingestedAt`, `dimensions`, `sourceUrl` |
| `TradeRecord` | `ingestion/statcan/types.ts` | 8 | `indicatorType`, `tradeDirection`, `tradeType`, `partner`, `partnerCode`, `productCategory`, `province`, `seasonalAdjustment` |
| `WdsCubeLite` | `ingestion/statcan/types.ts` | 10 | `productId`, `cubeTitleEn`, `cubeTitleFr`, `cubeSummaryEn`, `cubeSummaryFr`, `subjectCode`, `subjectEn`, `subjectFr`, `releaseTime`, `frequency` |
| `WdsCubeMetadata` | `ingestion/statcan/types.ts` | 11 | `productId`, `cubeTitleEn`, `cubeTitleFr`, `cubeSummaryEn`, `cubeSummaryFr`, `subjectCode`, `subjectEn`, `subjectFr`, `releaseTime`, `frequency`, `dimension` |
| `WdsErrorResponse` | `ingestion/statcan/types.ts` | 3 | `status`, `message` |
| `TelecomCsvRow` | `ingestion/telecommunications/parser.ts` | 5 | `provider`, `serviceType`, `revenue`, `subscribers`, `year` |
| `RawTelecommunicationsRecord` | `ingestion/telecommunications/types.ts` | 5 | — |
| `TelecommunicationsIngestionOptions` | `ingestion/telecommunications/types.ts` | 4 | — |
| `TelecommunicationsIngestionResult` | `ingestion/telecommunications/types.ts` | 5 | `recordsFound`, `recordsIngested`, `newRecords`, `errors`, `durationMs` |
| `TelecommunicationsRecord` | `ingestion/telecommunications/types.ts` | 13 | `id`, `sourceSystem`, `recordType`, `title`, `description`, `url`, `publishedAt`, `ingestedAt` |
| `CiibProject` | `ingestion/transport-infrastructure/types.ts` | 13 | `id`, `projectName`, `sector`, `subSector`, `province`, `ciibInvestment`, `totalProjectValue`, `commitmentDate`, `status`, `counterparty`, `description`, `sourceUrl`, `ingestedAt` |
| `CtaRuling` | `ingestion/transport-infrastructure/types.ts` | 12 | `id`, `rulingNumber`, `title`, `caseType`, `complainant`, `respondent`, `decisionDate`, `outcome`, `summary`, `sourceUrl`, `ckanDatasetId`, `ingestedAt` |
| `InfrastructureFunding` | `ingestion/transport-infrastructure/types.ts` | 15 | `id`, `projectName`, `recipient`, `province`, `riding`, `party`, `program`, `federalContribution`, `totalProjectValue`, `announcementDate`, `status`, `description`, `sourceUrl`, `ckanDatasetId`, `ingestedAt` |
| `NtcfProject` | `ingestion/transport-infrastructure/types.ts` | 13 | `id`, `projectName`, `recipient`, `province`, `transportMode`, `ntcfContribution`, `totalProjectValue`, `announcementDate`, `status`, `rationale`, `description`, `sourceUrl`, `ingestedAt` |
| `TcRecall` | `ingestion/transport-infrastructure/types.ts` | 13 | `id`, `recallNumber`, `make`, `model`, `yearRange`, `unitsAffected`, `component`, `hazard`, `correctiveAction`, `recallDate`, `sourceUrl`, `ckanDatasetId`, `ingestedAt` |
| `TcViolationAudit` | `ingestion/transport-infrastructure/types.ts` | 8 | `id`, `type`, `organization`, `actionDate`, `description`, `penaltyAmount`, `sourceUrl`, `ingestedAt` |
| `TransportInfrastructureIngestionResult` | `ingestion/transport-infrastructure/types.ts` | 5 | `source`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `TsbOccurrence` | `ingestion/transport-infrastructure/types.ts` | 21 | `id`, `occurrenceNumber`, `mode`, `category`, `status`, `occurrenceDate`, `location`, `province`, `latitude`, `longitude`, `fatalities`, `injuries`, `make`, `model`, `registration`, `operator`, `eventTypes`, `narrative`, `sourceUrl`, `ckanDatasetId`, `ingestedAt` |
| `GetDebatesByMemberResult` | `ingestion/uk-hansard/index.ts` | 3 | `memberId`, `debates`, `total` |
| `OnsDatasetResult` | `ingestion/uk-ons/types.ts` | 6 | `uri`, `title` |
| `OnsFactRecord` | `ingestion/uk-ons/types.ts` | 9 | `id`, `series`, `seriesTitle`, `value`, `period`, `frequency`, `lastUpdated` |
| `OnsIngestionResult` | `ingestion/uk-ons/types.ts` | 5 | `series`, `records`, `observationsExtracted`, `errors`, `durationMs` |
| `OnsTimeseriesData` | `ingestion/uk-ons/types.ts` | 4 | `description` |
| `ComtradeFetchResult` | `ingestion/un-comtrade/fetcher.ts` | 2 | `records` |
| `ComtradeApiResponse` | `ingestion/un-comtrade/types.ts` | 2 | `dataset` |
| `ComtradeRecord` | `ingestion/un-comtrade/types.ts` | 13 | — |
| `HSCode` | `ingestion/un-comtrade/types.ts` | 2 | `code`, `description` |
| `TradeFlow` | `ingestion/un-comtrade/types.ts` | 10 | `id`, `reporterCode`, `partnerCode`, `year`, `period`, `commodityCode`, `commodity`, `tradeFlow`, `value` |
| `SdmxValue` | `ingestion/un/types.ts` | 2 | — |
| `UnAllDatabasesResult` | `ingestion/un/types.ts` | 4 | `results`, `totalRecords`, `totalErrors`, `durationMs` |
| `UnDataflowInfo` | `ingestion/un/types.ts` | 4 | `id`, `name`, `databaseCode`, `description` |
| `UnIngestionResult` | `ingestion/un/types.ts` | 6 | `databaseCode`, `databaseName`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `UnRecord` | `ingestion/un/types.ts` | 14 | `id`, `databaseCode`, `databaseName`, `category`, `value`, `refArea`, `refAreaName`, `timePeriod`, `year`, `seriesKey`, `unit`, `obsStatus`, `ingestedAt`, `sourceUrl` |
| `HdiFetchResult` | `ingestion/undp-hdi/fetcher.ts` | 3 | `hdiValue`, `rank` |
| `HDIComponent` | `ingestion/undp-hdi/types.ts` | 5 | `country`, `lifeExpectancy`, `expectedSchooling`, `meanSchooling`, `gniPerCapita` |
| `HDIIngestionResult` | `ingestion/undp-hdi/types.ts` | 6 | `country`, `records`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `durationMs` |
| `HDIRecord` | `ingestion/undp-hdi/types.ts` | 11 | `id`, `country`, `countryCode`, `hdiValue`, `rank`, `year`, `category` |
| `UndpAllIndicatorsResult` | `ingestion/undp-hdr/types.ts` | 4 | `results`, `totalRecords`, `totalErrors`, `durationMs` |
| `UndpApiResponse` | `ingestion/undp-hdr/types.ts` | 2 | `data` |
| `UndpApiRow` | `ingestion/undp-hdr/types.ts` | 6 | — |
| `UndpIndicator` | `ingestion/undp-hdr/types.ts` | 4 | `code`, `name`, `description`, `unit` |
| `UndpIngestionResult` | `ingestion/undp-hdr/types.ts` | 6 | `indicatorCode`, `indicatorName`, `recordsFound`, `recordsIngested`, `errors`, `durationMs` |
| `UndpRecord` | `ingestion/undp-hdr/types.ts` | 11 | `id`, `indicatorCode`, `indicatorName`, `countryCode`, `countryName`, `year`, `value`, `rank`, `rankCount`, `ingestedAt`, `sourceUrl` |
| `UnescoDataset` | `ingestion/unesco-uis/types.ts` | 5 | `id`, `name`, `updateFrequency`, `sdmxUrlTemplate` |
| `UnescoIngestionResult` | `ingestion/unesco-uis/types.ts` | 5 | `datasetsAttempted`, `datasetsSucceeded`, `records`, `errors`, `durationMs` |
| `UnescoRecord` | `ingestion/unesco-uis/types.ts` | 10 | `id`, `datasetId`, `datasetName`, `country`, `indicatorCode`, `indicatorName`, `year`, `value`, `unit` |
| `UnescoSdmxResponse` | `ingestion/unesco-uis/types.ts` | 3 | — |
| `UnescoTopic` | `ingestion/unesco-uis/types.ts` | 4 | `code`, `name`, `datasets` |
| `UNHCRModuleMetadata` | `ingestion/unhcr-refugee/index.ts` | 3 | `sourcesAttempted`, `sourcesSucceeded`, `errors` |
| `GetCanadaRefugeeDataResult` | `ingestion/unhcr-refugee/types.ts` | 7 | `year`, `refugeeStocks`, `asylumSeekers`, `asylumApplications`, `asylumDecisions`, `asylumRecognized`, `country` |
| `GetGlobalRefugeeStatsResult` | `ingestion/unhcr-refugee/types.ts` | 4 | `year`, `totalRefugees`, `totalAsylumSeekers`, `countriesWithData` |
| `GetRefugeeByCountryResult` | `ingestion/unhcr-refugee/types.ts` | 8 | `countryName`, `iso3`, `year`, `refugees`, `asylumSeekers`, `applications`, `decisions`, `recognized` |
| `UNHCRAsylumResponse` | `ingestion/unhcr-refugee/types.ts` | 3 | `year`, `applications`, `total` |
| `UNHCRPopulationResponse` | `ingestion/unhcr-refugee/types.ts` | 3 | `year`, `refugeeStocks`, `total` |
| `UnhcrFetchResult` | `ingestion/unhcr-refugees/fetcher.ts` | 2 | `records` |
| `RefugeeIngestionResult` | `ingestion/unhcr-refugees/types.ts` | 7 | `countryCode`, `year`, `records`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `durationMs` |
| `RefugeeRecord` | `ingestion/unhcr-refugees/types.ts` | 6 | `id`, `countryCode`, `year`, `populationType`, `value`, `source` |
| `UnhcrPopulationRecord` | `ingestion/unhcr-refugees/types.ts` | 5 | `iso3`, `year`, `population_type`, `population_value`, `population_category` |
| `UnionRecord` | `ingestion/unions/types.ts` | 9 | `unionName`, `year`, `source`, `url`, `hash`, `ingestedAt` |
| `UnionsIngestionResult` | `ingestion/unions/types.ts` | 5 | `records`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `durationMs` |
| `UniversitiesIngestionResult` | `ingestion/universities/types.ts` | 5 | `records`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `durationMs` |
| `UniversityRecord` | `ingestion/universities/types.ts` | 13 | `institution`, `province`, `year`, `source`, `url`, `hash`, `ingestedAt` |
| `CiaCountryComparison` | `ingestion/us-cia/types.ts` | 4 | `field`, `fieldName`, `entries`, `lastUpdated` |
| `CiaFactRecord` | `ingestion/us-cia/types.ts` | 9 | `id`, `countryCode`, `countryName`, `field`, `fieldName`, `category`, `value`, `rank`, `year` |
| `CiaIngestionResult` | `ingestion/us-cia/types.ts` | 6 | `countryCode`, `records`, `fieldsAttempted`, `fieldsSucceeded`, `errors`, `durationMs` |
| `CiaRawProfile` | `ingestion/us-cia/types.ts` | 5 | `country_code`, `country_name`, `region`, `fields`, `last_updated` |
| `GetCanadianCompaniesResult` | `ingestion/us-sec-edgar/index.ts` | 2 | `companies`, `total` |
| `GetRecentFilingsResult` | `ingestion/us-sec-edgar/index.ts` | 3 | `cik`, `filings`, `total` |
| `UtilityProvider` | `ingestion/utilities/constants.ts` | 6 | `id`, `name`, `province`, `type`, `url`, `serviceArea` |
| `GasRecord` | `ingestion/utilities/types.ts` | 10 | `id`, `name`, `province`, `customerCount`, `distributionVolume`, `rateType`, `averageRate`, `sourceUrl`, `utilityType`, `ingestedAt` |
| `HydroRecord` | `ingestion/utilities/types.ts` | 10 | `id`, `name`, `province`, `customerCount`, `generationCapacityMW`, `rateType`, `averageRate`, `sourceUrl`, `utilityType`, `ingestedAt` |
| `UtilityIngestionResult` | `ingestion/utilities/types.ts` | 3 | `providers`, `errors`, `durationMs` |
| `UtilityParserOptions` | `ingestion/utilities/types.ts` | 2 | — |
| `UtilityRecord` | `ingestion/utilities/types.ts` | 8 | `id`, `name`, `province`, `type`, `serviceArea`, `url` |
| `DndVeteranProgramRecord` | `ingestion/veterans/types.ts` | 5 | `program`, `year`, `budget`, `description`, `department` |
| `OsissClinicRecord` | `ingestion/veterans/types.ts` | 5 | `clinic`, `province`, `year`, `patientsServed`, `referrals` |
| `VacBenefitStat` | `ingestion/veterans/types.ts` | 5 | `program`, `year`, `recipients`, `expenditure`, `category` |
| `VeteransIngestionResult` | `ingestion/veterans/types.ts` | 3 | `records`, `errors`, `durationMs` |
| `VeteransRecord` | `ingestion/veterans/types.ts` | 12 | `id`, `year`, `category`, `value` |
| `VeteranSuicideStat` | `ingestion/veterans/types.ts` | 5 | `year`, `deaths`, `rate`, `population`, `demographic` |
| `ChangeEvent` | `ingestion/watcher.ts` | 8 | `sourceId`, `sourceName`, `detectedAt`, `previousHash`, `currentHash`, `changed`, `summary`, `recordCount` |
| `WatchedSource` | `ingestion/watcher.ts` | 5 | `id`, `name`, `url`, `intervalMs`, `type` |
| `DispatchResult` | `ingestion/webhooks.ts` | 6 | `webhookId`, `url`, `success`, `statusCode`, `durationMs` |
| `WebhookConfig` | `ingestion/webhooks.ts` | 10 | `id`, `url`, `secret`, `sourceFilter`, `active`, `label`, `maxRetries`, `timeoutMs`, `created_at`, `updated_at` |
| `WebhookDelivery` | `ingestion/webhooks.ts` | 8 | `webhookId`, `sourceId`, `eventId`, `attemptedAt`, `statusCode`, `success`, `durationMs` |
| `WhoGhoFetchResult` | `ingestion/who-gho/fetcher.ts` | 2 | `records` |
| `WhoGhoIngestionResult` | `ingestion/who-gho/types.ts` | 8 | `indicatorCode`, `countryCode`, `year`, `records`, `sourcesAttempted`, `sourcesSucceeded`, `errors`, `durationMs` |
| `WhoGhoRawRecord` | `ingestion/who-gho/types.ts` | 13 | `IndicatorCode`, `IndicatorName`, `SpatialDim`, `SpatialDimType`, `TimeDim`, `TimeDimType`, `NumericValue`, `Low`, `High`, `Comments`, `Unit`, `ValueType`, `ValueTypeDescription` |
| `WhoGhoRecord` | `ingestion/who-gho/types.ts` | 9 | `id`, `indicatorCode`, `indicatorName`, `countryCode`, `countryName`, `year`, `value`, `source` |
| `IdsComparison` | `ingestion/worldbank-ids/types.ts` | 3 | `indicatorCode`, `indicatorName`, `countries` |
| `IdsCountryProfile` | `ingestion/worldbank-ids/types.ts` | 4 | `country`, `indicators`, `latestYear`, `summary` |
| `IdsTrendAnalysis` | `ingestion/worldbank-ids/types.ts` | 7 | `indicatorCode`, `country`, `values`, `trend`, `changePercent`, `latestValue`, `earliestValue` |
| `IndicatorMetadata` | `ingestion/worldbank-ids/types.ts` | 3 | `code`, `name`, `unit` |
| `IndicatorValue` | `ingestion/worldbank-ids/types.ts` | 7 | `country`, `countryiso3code`, `indicatorCode`, `indicatorName`, `year`, `value`, `unit` |
| `Indicator` | `ingestion/worldbank-wdi/types.ts` | 2 | `code`, `name` |
| `IndicatorMetadata` | `ingestion/worldbank-wdi/types.ts` | 3 | `code`, `name`, `unit` |
| `IndicatorValue` | `ingestion/worldbank-wdi/types.ts` | 5 | `id`, `country`, `indicatorCode`, `year`, `value` |
| `WdiComparison` | `ingestion/worldbank-wdi/types.ts` | 3 | `indicatorCode`, `entries`, `lastUpdated` |
| `WdiCountryProfile` | `ingestion/worldbank-wdi/types.ts` | 3 | `country`, `indicators`, `lastUpdated` |
| `WdiTrendAnalysis` | `ingestion/worldbank-wdi/types.ts` | 7 | `indicatorCode`, `country`, `trend`, `changeRate`, `startYear`, `endYear`, `dataPoints` |
| `WgiComparison` | `ingestion/worldbank-wgi/types.ts` | 3 | `indicatorCode`, `indicatorName`, `countries` |
| `WgiCountrySnapshot` | `ingestion/worldbank-wgi/types.ts` | 5 | `country`, `year`, `indicators`, `overallScore`, `percentileRank` |
| `WgiIndicatorValue` | `ingestion/worldbank-wgi/types.ts` | 9 | `country`, `countryiso3code`, `indicatorCode`, `indicatorName`, `year`, `value`, `standardError`, `numSources`, `rank` |
| `WgiTrendAnalysis` | `ingestion/worldbank-wgi/types.ts` | 7 | `indicatorCode`, `country`, `values`, `trend`, `changePercent`, `latestValue`, `earliestValue` |

### `test-framework`

| Schema | File | Fields | Required fields |
|--------|------|--------|-----------------|
| `CitationCheckInput` | `test-framework/citation-validator.ts` | 4 | `moduleName`, `recordId`, `content`, `expectedHash` |
| `CrossReferenceCheck` | `test-framework/cross-reference-validator.ts` | 6 | `moduleName`, `sourceField`, `targetModule`, `targetField`, `sourceValue`, `targetExists` |
| `QASummary` | `test-framework/types.ts` | 7 | `totalModules`, `totalTests`, `totalPassed`, `totalFailed`, `coverage`, `lastRunAt`, `suites` |
| `SchemaConstraint` | `test-framework/types.ts` | 9 | `field` |
| `TestResult` | `test-framework/types.ts` | 8 | `moduleName`, `testName`, `status`, `severity`, `message`, `durationMs` |
| `TestSuiteResult` | `test-framework/types.ts` | 9 | `moduleName`, `total`, `passed`, `failed`, `skipped`, `errors`, `durationMs`, `results`, `timestamp` |
| `ValidationRule` | `test-framework/types.ts` | 4 | `name`, `description`, `severity`, `validate` |

### `validation`

| Schema | File | Fields | Required fields |
|--------|------|--------|-----------------|
| `ModuleValidationReport` | `validation/schema-validator.ts` | 6 | `moduleName`, `upstreamHealthy`, `parserValid`, `schemaDriftDetected` |
| `SchemaDescriptor` | `validation/types.ts` | 4 | `moduleName`, `schemaVersion`, `fields`, `capturedAt` |
| `SchemaField` | `validation/types.ts` | 8 | `name`, `required`, `type` |
| `ValidationConfig` | `validation/types.ts` | 3 | — |
| `ValidationFinding` | `validation/types.ts` | 7 | `field`, `check`, `status`, `severity`, `message` |
| `ValidationResult` | `validation/types.ts` | 7 | `moduleName`, `status`, `schemaVersion`, `findings`, `validatedAt`, `durationMs`, `summary` |

### `verification`

| Schema | File | Fields | Required fields |
|--------|------|--------|-----------------|
| `FiveGWAnalysisResult` | `verification/fifth-gen-warfare.ts` | 8 | `threatScore`, `threatLevel`, `patterns`, `confidence`, `recommendedAction`, `matchAgainstTrackedActors`, `summary`, `ruleBased` |
| `FiveGWDefenseConfig` | `verification/fifth-gen-warfare.ts` | 7 | — |
| `FiveGWPattern` | `verification/fifth-gen-warfare.ts` | 4 | `type`, `description`, `severity`, `evidence` |
| `ThreatAssessment` | `verification/fifth-gen-warfare.ts` | 4 | `score`, `flags`, `confidence`, `details` |
| `TrackedActorMatch` | `verification/fifth-gen-warfare.ts` | 4 | `actorId`, `actorName`, `matchType`, `confidence` |
| `CitationRecord` | `verification/hashing.ts` | 7 | `articleId`, `contentHash`, `algorithm`, `hashLength`, `computedAt`, `verifiedCount`, `lastVerifiedAt` |
| `JournalismBadgeState` | `verification/journalism-mode.ts` | 6 | `level`, `verified`, `issuedAt`, `expiresAt`, `badgeToken` |
| `JournalismCapabilities` | `verification/journalism-mode.ts` | 10 | `accessJournalismModules`, `accessEnhancedCitations`, `bulkCitations`, `rawDataExport`, `historicalBackfill`, `priorityApiAccess`, `realtimeFeeds`, `webhookNotifications`, `maxDailyIngestRequests`, `maxCitationsPerRequest` |

## Related MCP tools

| Tool | Description |
|------|-------------|
| `qa_schema` | Field-level schema for one module, served from the same extractor as this index. |
| `resolve_entity` | Resolve a name to a canonical `quill://entity/{id}` URI. |
| `linked_entities` | Per-registry evidence and connections for one entity (premium). |
| `search_cross_reference` | Graph-backed cross-reference: resolve plus per-registry buckets in one call. |
| `get_citation` | Fetch a claim bundle, including its SHA-256 data hash. |
| `verify_claim` | Recompute and compare a claim hash against the bundle. |

## Related MCP resources

| Resource | Returns |
|----------|---------|
| `quill://schemas` | Module schema index: name, file, field count, required fields. |
| `quill://schemas/{module}` | Versioned field-level schema for one module. |
| `quill://entity/{id}` | Entity subgraph fragment for a canonical entity id. |
| `quill://crossref/{entityId}` | Resolvable entity subgraph for federation between MCP servers. |
| `quill://citations/{hash}` | Claim bundle for a SHA-256 hash. |

## Verifying a schema payload

Every claim bundle carries a SHA-256 hash of its canonical JSON. The
public verification route needs no API key:

```bash
curl -s -X POST https://api.maplespike.ca/v1/claims/verify \
  -H 'content-type: application/json' \
  -d '{"data":{"b":2,"a":1},"sha256":"<hash>"}'
```

See `packages/sdk/examples/verify-claim.ts` for a runnable TypeScript
version, and `packages/sdk/examples/crossref-agent.ts` for the federated
cross-reference flow (`linked_entities` / `search_cross_reference`).
