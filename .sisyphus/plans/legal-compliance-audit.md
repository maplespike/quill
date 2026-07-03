> ⚠️ **Historical artifact** — This document is preserved for context. The single source of truth for the active backlog is [`ROADMAP.md`](./ROADMAP.md). Do not edit without also updating ROADMAP.md.


# Legal Compliance Audit: MapleSpike

## TL;DR

> **Quick Summary**: Audit the three-tier license structure, verify dependency compliance, ensure proper attribution, and validate OGL-CA data usage. Identify and fix license discrepancies across packages.
>
> **Deliverables**: License compliance report, dependency SBOM, attribution manifest, remediation action items
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves

---

## Context

### Original Request
Plan a legal compliance audit for MapleSpike project.

### Interview Summary
**Key Discussions**:
- Project uses three-tier license structure (AGPL-3.0, Apache-2.0, MIT)
- Potential license discrepancy found in mcp-server (package.json says Apache-2.0, README says MIT)
- 10 packages in pnpm workspace
- Canadian government data under OGL-CA

**Research Findings**:
- Root LICENSE file is AGPL-3.0
- LICENSE.md documents three-tier structure
- No existing compliance documentation

### Metis Review
**Identified Gaps** (addressed):
- License discrepancy in mcp-server package needs resolution
- Dependency audit required for pnpm-lock.yaml

---

## Work Objectives

### Core Objective
Verify legal compliance across the MapleSpike codebase including license adherence, dependency licensing, attribution requirements, and Canadian open government data compliance.

### Concrete Deliverables
- License compliance verification report
- Software Bill of Materials (SBOM) with dependency licenses
- Attribution manifest for third-party code
- OGL-CA compliance checklist for data sources
- Remediation plan for any license discrepancies

### Definition of Done
- [ ] All package licenses verified against LICENSE.md policy
- [ ] All dependencies checked for license compatibility
- [ ] Attribution notices generated for all third-party code
- [ ] OGL-CA data usage validated
- [ ] Report delivered to legal@maplespike.lan

### Must Have
- Zero license incompatibilities blocking distribution
- Complete attribution for all third-party dependencies
- Proper OGL-CA attribution for source data

### Must NOT Have
- External dependencies with restrictive licenses (AGPL/GPL incompatible with commercial use)
- Missing attribution that could cause copyright claims
- Misrepresented licensing in package.json files

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (pnpm lockfile, TypeScript)
- **Automated tests**: Tests after - generate compliance report, then verify outputs

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - foundation + scaffolding):
├── Task 1: Set up compliance tooling (license-checker, licensee) [quick]
├── Task 2: Map all package.json files and their declared licenses [quick]
├── Task 3: Extract all dependencies from pnpm-lock.yaml [quick]
├── Task 4: Create license compatibility matrix [quick]
└── Task 5: Document current OGL-CA data sources [quick]

Wave 2 (Dependency & Package Analysis):
├── Task 6: Audit pipeline-core (AGPL) dependencies for copyleft conflicts [deep]
├── Task 7: Audit mcp-server license discrepancy (Apache-2.0 vs MIT) [quick]
├── Task 8: Audit all Apache-2.0 tier packages [unspecified-high]
├── Task 9: Audit all MIT tier packages [quick]
├── Task 10: Generate dependency SBOM with license info [deep]
└── Task 11: Check for GPL/incompatible dependencies [unspecified-high]

Wave 3 (Reporting & Remediation):
├── Task 12: Create attribution manifest for all third-party code [quick]
├── Task 13: Verify OGL-CA source attribution requirements [deep]
├── Task 14: Compile compliance report with findings [deep]
├── Task 15: Recommend remediation for any issues [quick]
└── Task 16: Update license fields if discrepancies found [quick]

Wave FINAL (Verification & Delivery):
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review [unspecified-high]
└── Task F3: Scope fidelity check [deep]
```

---

## TODOs

- [ ] 1. Set up compliance tooling

  **What to do**:
  - Install license-checker or similar tool
  - Configure for pnpm workspace
  - Create compliance output directory

  **Must NOT do**:
  - Don't modify existing package.json files
  - Don't install runtime dependencies

  **Recommended Agent Profile**:
  > quick - Setup and scaffolding tasks

  **Parallelization**:
  - Can Run In Parallel: NO (foundation task)
  - Blocks: 2, 3, 4, 5, 6
  - Blocked By: None

  **Acceptance Criteria**:
  - Tool installed and configured
  - Output directory created

  **QA Scenarios**:
  ```
  Scenario: License checker runs successfully
    Tool: Bash
    Preconditions: pnpm workspace with dependencies installed
    Steps:
      1. Run license-checker --summary
      2. Verify output contains license information
    Expected Result: JSON/CSV output with all dependencies and licenses
    Evidence: .sisyphus/evidence/task-1-license-checker.log
  ```

  **Commit**: NO

- [ ] 2. Map all package.json files and their declared licenses

  **What to do**:
  - List all 10 package.json files
  - Extract license field from each
  - Compare against LICENSE.md three-tier policy
  - Flag any discrepancies

  **Must NOT do**:
  - Don't modify any files yet
  - Don't check dependencies in this task

  **Parallelization**:
  - Can Run In Parallel: YES (Wave 1)
  - Blocks: 14
  - Blocked By: None

  **Acceptance Criteria**:
  - Table of all packages with declared licenses
  - List of any deviations from policy

  **QA Scenarios**:
  ```
  Scenario: All packages mapped correctly
    Tool: Bash
    Preconditions: Task 1 complete
    Steps:
      1. Run node script to extract license from all package.json
      2. Compare output to expected: pipeline-core=AGPL, api-server=Apache, mcp-server=Apache, engine=AGPL, sdk=MIT, etc.
    Expected Result: All packages match LICENSE.md three-tier structure
    Evidence: .sisyphus/evidence/task-2-license-mapping.json
  ```

- [ ] 3. Extract all dependencies from pnpm-lock.yaml

  **What to do**:
  - Parse pnpm-lock.yaml
  - Extract all external dependencies with versions
  - Group by package that depends on them

  **Parallelization**:
  - Can Run In Parallel: YES
  - Blocks: 10
  - Blocked By: None

  **Acceptance Criteria**:
  - Complete list of all external dependencies

  **QA Scenarios**:
  ```
  Scenario: Dependencies extracted correctly
    Tool: Bash
    Preconditions: pnpm-lock.yaml exists
    Steps:
      1. Run node script to parse pnpm-lock.yaml
      2. Count unique dependencies
    Expected Result: 50+ dependencies listed with versions
    Evidence: .sisyphus/evidence/task-3-dependencies.json
  ```

- [ ] 4. Create license compatibility matrix

  **What to do**:
  - Map each dependency license
  - Check compatibility with AGPL-3.0 (core tier)
  - Check compatibility with Apache-2.0 (interface tier)
  - Check compatibility with MIT (client tier)
  - Flag any conflicts

  **Parallelization**:
  - Can Run In Parallel: YES
  - Blocks: 6, 7, 10
  - Blocked By: 3

  **Acceptance Criteria**:
  - Matrix showing compatibility for each tier
  - List of conflicting dependencies (if any)

  **QA Scenarios**:
  ```
  Scenario: Compatibility matrix generated
    Tool: Bash
    Preconditions: Task 3 complete
    Steps:
      1. Run license compatibility check
      2. Verify GPL dependencies flagged for AGPL tier
    Expected Result: CSV matrix with compatibility status
    Evidence: .sisyphus/evidence/task-4-compatibility.csv
  ```

- [ ] 5. Document current OGL-CA data sources

  **What to do**:
  - Review README.md for data sources
  - Map sources to OGL-CA requirements
  - Document attribution requirements

  **Parallelization**:
  - Can Run In Parallel: YES
  - Blocks: 13
  - Blocked By: None

  **Acceptance Criteria**:
  - List of all OGL-CA data sources used
  - Required attribution format documented

- [ ] 6. Audit pipeline-core (AGPL) dependencies

  **What to do**:
  - Focus on AGPL tier packages
  - Verify all dependencies are AGPL-compatible
  - Check amqplib, fast-xml-parser, undici licenses

  **Parallelization**:
  - Can Run In Parallel: NO (depends on 4)
  - Blocked By: 4

  **Acceptance Criteria**:
  - AGPL compatibility verified
  - Any issues documented

- [ ] 7. Audit mcp-server license discrepancy

  **What to do**:
  - Investigate discrepancy: package.json says Apache-2.0, README says MIT
  - Check LICENSE file in mcp-server directory
  - Determine correct license per LICENSE.md policy
  - Recommend fix

  **Parallelization**:
  - Can Run In Parallel: YES (Wave 2)
  - Blocked By: 2

  **Acceptance Criteria**:
  - Root cause identified
  - Correct license per policy determined

  **QA Scenarios**:
  ```
  Scenario: License discrepancy resolved
    Tool: Bash
    Preconditions: Files read
    Steps:
      1. Read packages/mcp-server/package.json license field
      2. Read packages/mcp-server/README.md license section
      3. Read LICENSE.md three-tier policy for interface tier
    Expected Result: Documentation of discrepancy and correct license
    Evidence: .sisyphus/evidence/task-7-mcp-license-discrepancy.txt
  ```

- [ ] 8. Audit all Apache-2.0 tier packages

  **What to do**:
  - Check api-server, mcp-server (once fixed), docs, portal
  - Verify Apache-2.0 license declarations

  **Parallelization**:
  - Can Run In Parallel: YES

- [ ] 9. Audit all MIT tier packages

  **What to do**:
  - Check sdk, sdk-python, legal-core, legislation

- [ ] 10. Generate dependency SBOM

  **What to do**:
  - Create Software Bill of Materials
  - Include all dependencies with licenses
  - Format as SPDX or CycloneDX

  **Parallelization**:
  - Can Run In Parallel: YES
  - Blocked By: 3, 4

- [ ] 11. Check for GPL/incompatible dependencies

  **What to do**:
  - Search for GPL, AGPL, LGPL dependencies
  - Flag any that create copyleft obligations
  - Check if used in commercial-tier packages

- [ ] 12. Create attribution manifest

  **What to do**:
  - Generate NOTICE file content
  - Include all third-party copyright notices
  - Format for both AGPL and permissive tiers

- [ ] 13. Verify OGL-CA source attribution

  **What to do**:
  - Check README and docs for OGL-CA attribution
  - Verify proper attribution format
  - Document requirements for data redistribution

- [ ] 14. Compile compliance report

  **What to do**:
  - Summarize all findings
  - List any issues found
  - Provide recommendations

- [ ] 15. Recommend remediation

  **What to do**:
  - Prioritized list of fixes needed
  - License corrections
  - Attribution additions

- [ ] 16. Update license fields if discrepancies found

  **What to do**:
  - Fix package.json license fields if needed
  - Update README files
  - Ensure consistency with LICENSE.md

- [ ] F1. Plan compliance audit [oracle]

  **What to do**:
  - Verify all "Must Have" met
  - Verify all "Must NOT Have" absent

- [ ] F2. Code quality review [unspecified-high]

  **What to do**:
  - Run lint checks
  - Verify report format

- [ ] F3. Scope fidelity check [deep]

  **What to do**:
  - Verify 1:1 between plan and execution

---

## Commit Strategy

- 15: `docs(legal): fix mcp-server license field to Apache-2.0` - packages/mcp-server/package.json
- 16: `docs(legal): add attribution notices` - NOTICES, packages/*/LICENSE

---

## Success Criteria

### Verification Commands
```bash
node -e "console.log(require('./packages/pipeline-core/package.json').license)"
# Expected: AGPL-3.0-or-later

node -e "console.log(require('./packages/mcp-server/package.json').license)"
# Expected: Apache-2.0 (after fix)

node -e "console.log(require('./packages/sdk/package.json').license)"
# Expected: MIT
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] Compliance report generated