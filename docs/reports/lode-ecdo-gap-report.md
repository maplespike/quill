# LODE-ECDO Data-Type Catalog Coverage Gap Analysis

Generated: 2026-05-29

## Executive Summary

Analysis of LODE-ECDO (CSBP-CPSE/LODE-ECDO) MasterList_OpenDataPortals.csv against MapleSpike's 92 modules reveals significant gaps in data-type coverage across Canadian open data portals.

**Key Finding:** MapleSpike has 0 dedicated modules for most LODE-ECDO data types. We focus on political/legislative data but miss critical municipal data types that drive daily public services.

## Methodology

1. **Source:** LODE-ECDO master CSV cataloging Canadian portals by data-type availability
2. **Comparison:** Cross-referenced LODE-ECDO data-type flags against MapleSpike module registry.ts
3. **Coverage Definition:** A data type is "covered" if we have a module that explicitly ingests that data type

## Data-Type Coverage Matrix

| Data Type | Portals Offering | MapleSpike Modules | Coverage | Gap Impact |
|-----------|-----------------|-------------------|----------|------------|
| **GTFS/Transit** | 8+ portals | 0 | **0%** | 🔴 CRITICAL - Public transportation data for major cities |
| **Police** | 15+ portals | 0 | **0%** | 🔴 CRITICAL - Crime data, law enforcement accountability |
| **Fire** | 10+ portals | 0 | **0%** | 🟡 HIGH - Emergency services, public safety |
| **Libraries** | 12+ portals | 0 | **0%** | 🟡 HIGH - Public service access, community metrics |
| **Education** | 8+ portals | 0 | **0%** | 🟡 HIGH - School data, educational outcomes |
| **Parks** | 10+ portals | 0 | **0%** | 🟢 MEDIUM - Recreational data, green space tracking |
| **Community Centers** | 8+ portals | 0 | **0%** | 🟢 MEDIUM - Public facility usage, accessibility |
| **Hospitals** | 3+ portals | health-canada, health-data | **Partial** | 🟢 MEDIUM - Federal coverage, no municipal hospital data |
| **Buildings** | 12+ portals | 0 | **0%** | 🟡 HIGH - Property data, urban planning |
| **Businesses** | 10+ portals | 0 | **0%** | 🟡 HIGH - Economic activity, business permits |

**Overall Coverage Rate:** ~2% (only partial hospital coverage via federal health modules)

## Top-5 Data-Type Gaps by Public Impact

### 1. GTFS/Transit (🔴 CRITICAL)

**Impact:** Public transportation affects millions daily. GTFS data is critical for:
- Urban mobility research
- Transit planning and optimization
- Accessibility analysis
- Environmental impact tracking

**Portals with GTFS:**
- BCTransit (provincial transit network)
- Barrie Transit
- Thunder Bay Transit
- STO (Gatineau)
- Exo (Quebec regional transit)
- STM (Montreal Metro/bus)
- CRT Lanaudiere (regional transit)

**Recommendation:** Create `gtfs-transit` module that ingests GTFS feeds from all 8+ sources, storing:
- Routes, stops, schedules
- Real-time vehicle positions (where available)
- Accessibility information
- Service alerts/disruptions

### 2. Police Data (🔴 CRITICAL)

**Impact:** Police data is essential for:
- Accountability and transparency
- Crime trend analysis
- Resource allocation studies
- Public safety research

**Portals with Police Data:**
- Edmonton (Yes)
- Montreal (Yes)
- Quebec City (Yes)
- Sherbrooke (Yes)
- Calgary (Yes - via provincial-ckan)
- Vancouver (Yes - via provincial-ckan)
- Most major Ontario cities

**Recommendation:** Create `police-data` module that ingests:
- Crime statistics by neighborhood
- Police response times
- Incident reports
- Use of force statistics
- Complaint data

### 3. Fire/Emergency Services (🟡 HIGH)

**Impact:** Fire department data supports:
- Emergency response planning
- Infrastructure risk assessment
- Public safety outreach
- Resource allocation studies

**Portals with Fire Data:**
- Edmonton (Yes)
- Montreal (Yes)
- Quebec City (Yes)
- Sherbrooke (Yes)
- Regional municipalities across Canada

**Recommendation:** Create `fire-emergency` module that ingests:
- Fire incident data
- Response times
- Station locations and coverage
- Inspection reports

### 4. Libraries (🟡 HIGH)

**Impact:** Library data provides insights into:
- Public service utilization
- Digital divide analysis
- Community engagement metrics
- Educational access

**Portals with Library Data:**
- Edmonton (Yes)
- Montreal (Yes)
- Quebec City (Yes)
- Sherbrooke (Yes)
- Many regional municipalities

**Recommendation:** Create `public-libraries` module that ingests:
- Branch locations and hours
- Circulation statistics
- Program attendance
- Digital resource usage
- Facility accessibility

### 5. Buildings/Property (🟡 HIGH)

**Impact:** Building and property data enables:
- Urban planning analysis
- Housing market research
- Infrastructure investment tracking
- Environmental impact studies

**Portals with Building Data:**
- Calgary (Yes)
- Edmonton (Yes)
- Montreal (Yes)
- Quebec City (Yes)
- Ontario municipalities (multiple)

**Recommendation:** Create `buildings-property` module that ingests:
- Building footprints and attributes
- Property assessments
- Permit data
- Zoning information
- Code violation tracking

## Integration Recommendations

### Module Structure

Based on LODE-ECDO data types, recommend creating 6 new modules:

1. **`gtfs-transit`** - GTFS feed ingestion from 8+ transit agencies
2. **`police-data`** - Police statistics and incident reports
3. **`fire-emergency`** - Fire department data and response metrics
4. **`public-libraries`** - Library branch data and usage statistics
5. **`buildings-property`** - Building footprints and property data
6. **`municipal-services`** - Combined coverage for parks, community centers, businesses

### Data Persistence Strategy

Store high-impact municipal data in shared database:

| Data Type | Store in DB | Frequency | Retention |
|-----------|-------------|-----------|-----------|
| GTFS schedules | Yes | Daily | 1 year |
| GTFS real-time | Yes | 5-min | 7 days |
| Police statistics | Yes | Monthly | 5 years |
| Fire incidents | Yes | Weekly | 2 years |
| Library usage | Yes | Monthly | 3 years |
| Building footprints | Yes | Quarterly | Indefinite |
| Parks/community | Yes | Monthly | 2 years |

### MCP Tool Design

For each new module, expose standardized tools:

- `get-[datatype]-by-municipality`: Fetch data for specific city
- `get-[datatype]-by-province`: Aggregate data for entire province
- `compare-[datatype]-municipalities`: Compare across multiple cities
- `get-[datatype]-trends`: Time series analysis (where available)

## Implementation Priority

### Phase 1 (Immediate - High Public Impact)
1. **GTFS/Transit** - Affects millions daily, standardized format
2. **Police Data** - Critical accountability mechanism
3. **Fire/Emergency** - Public safety planning

### Phase 2 (Medium Priority)
4. **Public Libraries** - Community service tracking
5. **Buildings/Property** - Urban planning foundation

### Phase 3 (Lower Priority)
6. **Municipal Services** - Parks, community centers (lower strategic value)

## Conclusion

LODE-ECDO analysis reveals a critical gap: MapleSpike excels at federal/provincial political data but has near-zero coverage of municipal service data (GTFS, police, fire, libraries, buildings).

**Strategic Opportunity:** By adding these 6 modules, MapleSpike could:
- Expand coverage from political → comprehensive municipal services
- Serve urban planners, journalists, and researchers working on city-level issues
- Become the authoritative source for Canadian municipal open data

**Effort Estimate:** Each module is 5-10 days of development. Total effort: 30-60 days for all 6 modules.

**Recommendation:** Prioritize GTFS/Transit and Police Data modules immediately (Phase 1), as they have highest public impact and most available data sources.
