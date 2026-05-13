Create /data/projects/own/maplespike/packages/pipeline-core/src/ingestion/proactive-disclosure/

Federal proactive disclosure is published by every department — contracts over $10K, travel, hospitality, reclassification. Data at https://search.open.canada.ca/proactive/ with CKAN API access.

Types: ProactiveDisclosureRecord with fields for department, vendor, value, description, date, contract type
Constants: CKAN package IDs for each department's proactive disclosure
Fetcher: CKAN search API to find records, pagination
Parser: Normalize across departments (different schemas per dept)
Index: ingestProactiveDisclosure(db, options)

Schema: proactive_disclosure table with indexes on vendor, department, value

Follow existing pattern from corporate/procurement.ts for reference.
