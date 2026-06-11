# Cross-Module Entity Linking

Maplespike Engine includes advanced cross-module entity linking capabilities that connect entities across different data sources (persons, organizations, committees, charities, contracts, lobbying filings, donations, disclosures, and GAC projects).

## Overview

The linking system operates on three pillars:

1. **Name Resolution** - Fuzzy matching of entity names using the `EntityResolver`
2. **Disambiguation** - Advanced disambiguation strategies when multiple candidates exist
3. **Contextual Correlation** - Linking based on temporal, geographic, and functional context

## New Entity Types

### Committee

Represents parliamentary/legislative committees.

**Fields:**
- `names`: Array of variant names
- `type`: "standing" | "special" | "joint" | "subcommittee" | "other"
- `scope`: "federal" | "provincial" | "municipal" | "other"
- `chamber`: Chamber name (e.g., "House of Commons", "Senate")
- `mandate`: Committee mandate description
- `members`: Array of committee members with roles
- `meetings`: Array of committee meetings
- `parentCommitteeId`: ID of parent committee (for subcommittees)

### Charity

Represents registered charities and non-profit organizations.

**Fields:**
- `names`: Array of variant names
- `registrationNumber`: CRA BN
- `type`: "charitable_organization" | "public_foundation" | "private_foundation" | "other"
- `status`: "registered" | "revoked" | "suspended" | "pending" | "other"
- `mandate`: Charity mandate
- `activities`: Array of program activities
- `financials`: Financial summary data
- `boardMembers`: Board of directors
- `address`: Contact information
- `website`: Organization website
- `parentOrganizationId`: Parent organization ID

## New Edge Types

| Edge Type | Source → Target | Description | Confidence Weight |
|-----------|----------------|-------------|-------------------|
| `member_of` | person → committee | Committee membership | 0.95 |
| `chairs` | person → committee | Committee chairperson | 0.98 |
| `testified_before` | person → committee | Testimony/presentation at committee | 0.85 |
| `board_member_of` | person → charity | Board membership | 0.97 |
| `executive_director_of` | person → charity | Executive/leadership role | 0.96 |
| `funds` | organization → charity | Funding/donation relationship | 0.92 |
| `affiliated_with` | organization → charity | Partnership/affiliation | 0.80 |
| `advisor_to` | person → organization/committee | Advisory relationship | 0.85 |

## Linking Rules

### Person → Committee

#### `person_committee_membership`

**Rule:** Links persons to committees when they are listed as members.

**Required Confidence:** 0.75

**Logic:**
1. Match person names to committee member names using `EntityResolver`
2. Apply `DisambiguationEngine` if multiple candidates exist
3. Check committee membership dates for temporal consistency

**Example Link:**
```typescript
{
  sourceId: "person-sarah-mitchell",
  targetId: "committee-ethics-2023",
  edgeType: "member_of",
  confidence: 0.90,
  reasoning: [
    "Member of committee 'Standing Committee on Access to Information'",
    "Role: member",
    "From 2021-01-01 to 2024-12-31",
    "Name match score: 0.92"
  ],
  method: "rule:person_committee_membership+disambiguation:exact_match_with_aliases"
}
```

#### `person_committee_chair`

**Rule:** Links persons to committees when they hold chair/vice-chair roles.

**Required Confidence:** 0.80

**Logic:**
- Same as membership, but only for chairs/vice-chairs

#### `person_committee_testimony`

**Rule:** Links persons to committees based on lobbying communications.

**Required Confidence:** 0.70

**Logic:**
1. Match person names to officials in lobbying filing communications
2. Match filing institution to committee chamber
3. Apply disambiguation

**Example:**
```typescript
{
  sourceId: "person-john-smith",
  targetId: "committee-industry-2024",
  edgeType: "testified_before",
  confidence: 0.78,
  reasoning: [
    "Testified/communicated regarding 'Bill C-11 amendments'",
    "Communication date: 2024-03-15",
    "Institution: Innovation, Science and Economic Development",
    "Related to committee: Standing Committee on Industry and Technology"
  ]
}
```

### Person → Charity

#### `person_charity_board`

**Rule:** Links persons to charities where they serve on the board.

**Required Confidence:** 0.80

**Logic:**
1. Match person names to charity board member names
2. Apply disambiguation
3. Verify board membership dates

#### `person_charity_executive`

**Rule:** Links persons to charities in executive/leadership roles.

**Required Confidence:** 0.80

**Logic:**
- Same as board membership, but filters for executive titles:
  - Executive Director
  - CEO
  - President
  - Director

### Organization → Charity

#### `org_charity_funding`

**Rule:** Links organizations to charities through donation records.

**Required Confidence:** 0.75

**Logic:**
1. Find corporate donations
2. Match donor organization names using `EntityResolver`
3. Match recipient to charity names
4. Apply disambiguation

**Example:**
```typescript
{
  sourceId: "org-lockheed-martin",
  targetId: "charity-veterans-affairs",
  edgeType: "funds",
  confidence: 0.87,
  reasoning: [
    "Donated $50,000 to charity 'Veterans Affairs Canada Foundation'",
    "Date: 2023-12-01",
    "Correlated with 3 donation records"
  ]
}
```

#### `org_charity_affiliated`

**Rule:** Links organizations to charities based on text similarity.

**Required Confidence:** 0.70

**Logic:**
1. Search for organization names in charity mandate and activity descriptions
2. Calculate match score
3. Return link if score exceeds threshold

### Organization → Lobbying

#### `org_lobbying_client`

**Rule:** Links organizations to lobbying filings where they are the client.

**Required Confidence:** 0.75

**Logic:**
1. Match organization names to lobbying client names
2. Apply disambiguation
3. Verify filing details

### Organization → Contract

#### `org_contract_vendor`

**Rule:** Links organizations to contract awards where they are the vendor.

**Required Confidence:** 0.80

**Logic:**
1. Match organization names to contract vendor names
2. Apply disambiguation
3. Include contract details (value, department, sole-source status)

### Committee → Lobbying

#### `committee_lobbying_oversight`

**Rule:** Links committees to lobbying filings they oversee.

**Required Confidence:** 0.70

**Logic:**
1. Match committee chamber to lobbying institution
2. Check if committee mandate aligns with filing subject
3. Return link if match exceeds threshold

## Disambiguation Strategies

When multiple candidates exist with similar confidence scores, the `DisambiguationEngine` applies the following strategies in priority order:

### 1. Exact Match with Aliases
Checks if the query string exactly matches any entity alias. Highest priority.

**Method:** `exact_match_with_aliases`
**Confidence:** 1.0

### 2. Auxiliary Data Correlation
Correlates candidates with auxiliary data sources:

- **Donations:** Checks if candidate appears as donor
- **Lobbying:** Checks if candidate appears in filings
- **Committees:** Checks committee membership
- **Charities:** Checks charity board membership

**Method:** `auxiliary_data_correlation`
**Confidence:** `base * 0.95`

**Example:**
```typescript
reasoning: [
  "Correlated with 3 donation records",
  "Examples: $50,000 to Liberal Party of Canada, $25,000 to Conservative Fund"
]
```

### 3. Geographic Proximity
Prefers candidates in the same geographic region (province/city).

**Method:** `geographic_proximity`
**Confidence:** `base * 0.90`

**Example:**
```typescript
reasoning: ["Located in Ontario"]
```

### 4. Temporal Consistency
Checks for active roles or registrations.

**Method:** `temporal_consistency`
**Confidence:** `base * 0.88`

**Example:**
```typescript
reasoning: [
  "Has 2 active role(s)",
  "Latest: Minister of National Defence at Department of National Defence"
]
```

### 5. Confidence Gap
If the highest-confidence candidate exceeds the second by ≥15%, accept it.

**Method:** `confidence_gap`
**Confidence:** `base`

**Example:**
```typescript
reasoning: [
  "Highest confidence candidate (0.92) exceeds second by 20%"
]
```

### 6. Ambiguous (Manual Review)
If no strategy can disambiguate, return `null` for manual review.

**Method:** `ambiguous_requires_review`
**Confidence:** `max(candidate_confidences)`

**Example:**
```typescript
reasoning: [
  "Multiple candidates with similar confidence: Sarah Mitchell (0.87), Sarah J. Mitchell (0.85)",
  "Confidence gaps too small for automatic disambiguation"
]
```

## Resolution Rules

### Person Name Resolution

The `EntityResolver` applies the following rules in order:

1. **Exact match** (normalized) → 1.0
2. **Alias table match** → 0.98
3. **Initial matching** (e.g., "S. Mitchell" ≈ "Sarah Mitchell") → 0.95
4. **Hyphenated/maiden name check** (e.g., "Mitchell-Patel" ≈ "Mitchell") → 0.88
5. **Fuse.js fuzzy match** (threshold 0.4) → `1 - score` (if ≥ 0.7)
6. **First/last name match** (ignoring middle name) → 0.92
7. **No match** → 0.0

### Organization Name Resolution

The `EntityResolver` applies the following rules in order:

1. **Exact match** (normalized) → 1.0
2. **Alias table match** → 0.98
3. **Alias direct mapping** → 0.97
4. **Strip legal suffixes** (Inc, Corp, Ltd, Canada) → 0.93
5. **Subsidiary detection** (name contains another name) → 0.85
6. **Fuse.js fuzzy match** (threshold 0.35) → `1 - score` (if ≥ 0.7)
7. **No match** → 0.0

## Usage Example

```typescript
import { AliasManager } from "./entity/aliases";
import { EntityResolver } from "./entity/resolver";
import { CrossModuleLinker } from "./entity/linker";
import { GraphBuilder } from "./graph/builder";

// Initialize
const aliasManager = new AliasManager(db);
const resolver = new EntityResolver(aliasManager);
const linker = new CrossModuleLinker(resolver);

// Find cross-module links
const links = linker.findLinks(
  persons,
  organizations,
  contracts,
  filings,
  donations,
  disclosures,
  gacProjects,
  committees,
  charities,
);

// Convert to edges
const edges = linker.linkResultsToEdges(links);

// Add to graph
for (const edge of edges) {
  graphBuilder.addEdge(edge);
}
```

## Performance Considerations

- **Fuzzy matching** is expensive; the linker uses candidate pre-filtering to minimize matches
- **Disambiguation** is only triggered when multiple candidates exist
- **Linking rules** are applied in parallel where possible
- **Deduplication** prevents redundant links

## Testing

The linking system is tested with:

1. **Unit tests** for individual strategies
2. **Integration tests** for rule application
3. **Benchmark tests** for performance validation

See: `src/entity/__tests__/linker.test.ts`