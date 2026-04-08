import { describe, expect, it } from "vitest";
import {
	categorizePartners,
	extractCountries,
	extractPartners,
	groupByPartner,
} from "./mapper";
import { GACParser } from "./parser";

// Realistic GAC Project Browser CSV
const SAMPLE_PROJECT_CSV = `project_id,title,description,department,country,region,budget,start_date,end_date,status,implementing_partners,sector
"GA-2023-AF-001","Afghanistan Humanitarian Assistance","Emergency food security and livelihood support for conflict-affected populations in Afghanistan","Global Affairs Canada","Afghanistan","South Asia",28500000,2023-04-01,2025-03-31,active,"World Food Programme|Italy|Lead Agency;Action Against Hunger|France|Implementing Partner",Humanitarian
"GA-2023-UK-002","Ukraine Resilience and Reconstruction","Support for democratic governance and infrastructure reconstruction in Ukraine","Global Affairs Canada","Ukraine","Europe",45000000,2023-01-15,2026-01-14,active,"United Nations Development Programme|USA|Lead Agency;World Bank|USA|Co-financer",Governance
"GA-2023-ET-003","Ethiopia Maternal Health Initiative","Improving maternal and child health outcomes in rural Ethiopia through community health worker training","Global Affairs Canada","Ethiopia","Sub-Saharan Africa",12800000,2023-06-01,2027-05-31,active,"UNICEF|USA|Lead Agency;Save the Children|UK|Implementing Partner",Health
"GA-2023-BD-004","Bangladesh Climate Resilience","Building climate resilience in coastal communities of Bangladesh through adaptive infrastructure","Global Affairs Canada","Bangladesh","South Asia",18200000,2023-03-01,2027-02-28,active,"BRAC|Bangladesh|Lead Agency;World Bank|USA|Co-financer;Government of Bangladesh Ministry of Environment|Bangladesh|Government Partner",Environment
"GA-2023-JO-005","Jordan Refugee Support Program","Education and livelihood programming for Syrian refugees in Jordan","Global Affairs Canada","Jordan","Middle East",15600000,2022-09-01,2025-08-31,active,"UNHCR|Switzerland|Lead Agency;Plan International|UK|Implementing Partner",Humanitarian
"GA-2023-CO-006","Colombia Peacebuilding Initiative","Support for the implementation of the peace agreement in rural Colombia","Global Affairs Canada","Colombia","Latin America",9800000,2023-01-01,2026-12-31,active,"United Nations Development Programme|USA|Lead Agency;Oxfam|UK|Implementing Partner",Peacebuilding
"GA-2023-HT-007","Haiti Reconstruction Program","Infrastructure rebuilding and governance support following natural disasters in Haiti","Global Affairs Canada","Haiti","Latin America",22000000,2023-02-01,2026-01-31,active,"World Bank|USA|Lead Agency;Red Cross|Switzerland|Implementing Partner",Infrastructure
"GA-2023-ID-008","Indonesia Sustainable Forestry","Promoting sustainable forestry management and biodiversity conservation in Kalimantan","Global Affairs Canada","Indonesia","Southeast Asia",7500000,2023-07-01,2026-06-30,pipeline,"World Wildlife Fund|USA|Lead Agency;Center for International Forestry Research|Indonesia|Research Partner",Environment
"GA-2022-MZ-009","Mozambique Education Quality","Improving primary education quality in northern Mozambique","Global Affairs Canada","Mozambique","Sub-Saharan Africa",11500000,2022-10-01,2025-09-30,active,"UNICEF|USA|Lead Agency;Save the Children|UK|Implementing Partner",Education
"GA-2022-UA-010","Ukraine Energy Security","Restoring energy infrastructure and supporting clean energy transition","Global Affairs Canada","Ukraine","Europe",35000000,2022-06-01,2025-05-31,completed,"World Bank|USA|Lead Agency;European Bank for Reconstruction and Development|UK|Co-financer",Energy`;

const SAMPLE_IATI_XML = `<?xml version="1.0" encoding="UTF-8"?>
<iati-activities>
  <iati-activity>
    <iati-identifier>CA-3-GA-2023-AF-001</iati-identifier>
    <title>Afghanistan Humanitarian Assistance</title>
    <description>Emergency food security and livelihood support for conflict-affected populations</description>
    <activity-date>2023-04-01</activity-date>
    <end-date>2025-03-31</end-date>
    <recipient-country>Afghanistan</recipient-country>
    <value>28500000</value>
    <sector>Humanitarian</sector>
    <participating-org>World Food Programme</participating-org>
    <participating-org>Action Against Hunger</participating-org>
  </iati-activity>
  <iati-activity>
    <iati-identifier>CA-3-GA-2023-UK-002</iati-identifier>
    <title>Ukraine Resilience and Reconstruction</title>
    <description>Support for democratic governance and infrastructure reconstruction</description>
    <activity-date>2023-01-15</activity-date>
    <end-date>2026-01-14</end-date>
    <recipient-country>Ukraine</recipient-country>
    <value>45000000</value>
    <sector>Governance</sector>
    <participating-org>United Nations Development Programme</participating-org>
    <participating-org>World Bank</participating-org>
  </iati-activity>
  <iati-activity>
    <iati-identifier>CA-3-GA-2023-ET-003</iati-identifier>
    <title>Ethiopia Maternal Health Initiative</title>
    <description>Improving maternal and child health outcomes in rural Ethiopia</description>
    <activity-date>2023-06-01</activity-date>
    <end-date>2027-05-31</end-date>
    <recipient-country>Ethiopia</recipient-country>
    <value>12800000</value>
    <sector>Health</sector>
    <participating-org>UNICEF</participating-org>
    <participating-org>Save the Children</participating-org>
  </iati-activity>
</iati-activities>`;

describe("GACParser", () => {
	const parser = new GACParser();

	describe("parseProjectBrowser", () => {
		it("parses CSV data into GACProject objects", () => {
			const result = parser.parseProjectBrowser(SAMPLE_PROJECT_CSV);
			expect(result.data).toHaveLength(10);
			expect(result.errors).toHaveLength(0);
			expect(result.metadata.source).toBe("gac_projects");
			expect(result.metadata.format).toBe("csv");
		});

		it("extracts project IDs", () => {
			const result = parser.parseProjectBrowser(SAMPLE_PROJECT_CSV);
			expect(result.data[0].projectId).toBe("GA-2023-AF-001");
			expect(result.data[1].projectId).toBe("GA-2023-UK-002");
		});

		it("extracts country and region", () => {
			const result = parser.parseProjectBrowser(SAMPLE_PROJECT_CSV);
			expect(result.data[0].country).toBe("Afghanistan");
			expect(result.data[0].region).toBe("South Asia");
			expect(result.data[1].country).toBe("Ukraine");
		});

		it("parses budget values", () => {
			const result = parser.parseProjectBrowser(SAMPLE_PROJECT_CSV);
			expect(result.data[0].budget).toBe(28500000);
			expect(result.data[9].budget).toBe(35000000);
		});

		it("parses implementing partners with pipe-separated fields", () => {
			const result = parser.parseProjectBrowser(SAMPLE_PROJECT_CSV);
			expect(result.data[0].implementingPartners).toHaveLength(2);
			expect(result.data[0].implementingPartners[0].name).toBe(
				"World Food Programme",
			);
			expect(result.data[0].implementingPartners[0].role).toBe("Lead Agency");
		});

		it("handles projects with multiple partners", () => {
			const result = parser.parseProjectBrowser(SAMPLE_PROJECT_CSV);
			// Bangladesh has 3 partners
			expect(result.data[3].implementingPartners).toHaveLength(3);
		});

		it("maps project statuses", () => {
			const result = parser.parseProjectBrowser(SAMPLE_PROJECT_CSV);
			expect(result.data[8].status).toBe("active");
			expect(result.data[7].status).toBe("pipeline");
			expect(result.data[9].status).toBe("completed");
		});

		it("sets department to Global Affairs Canada", () => {
			const result = parser.parseProjectBrowser(SAMPLE_PROJECT_CSV);
			for (const project of result.data) {
				expect(project.department).toBe("Global Affairs Canada");
			}
		});

		it("preserves raw data", () => {
			const result = parser.parseProjectBrowser(SAMPLE_PROJECT_CSV);
			expect(result.data[0].rawData.project_id).toBe("GA-2023-AF-001");
		});
	});

	describe("parseIATIXml", () => {
		it("parses IATI XML data", () => {
			const result = parser.parseIATIXml(SAMPLE_IATI_XML);
			expect(result.data).toHaveLength(3);
			expect(result.errors).toHaveLength(0);
			expect(result.metadata.format).toBe("xml");
		});

		it("extracts IATI identifiers", () => {
			const result = parser.parseIATIXml(SAMPLE_IATI_XML);
			expect(result.data[0].projectId).toBe("CA-3-GA-2023-AF-001");
		});

		it("extracts implementing partners from XML", () => {
			const result = parser.parseIATIXml(SAMPLE_IATI_XML);
			expect(result.data[0].implementingPartners).toHaveLength(2);
			expect(result.data[0].implementingPartners[0].name).toBe(
				"World Food Programme",
			);
		});

		it("extracts budget from XML", () => {
			const result = parser.parseIATIXml(SAMPLE_IATI_XML);
			expect(result.data[0].budget).toBe(28500000);
		});

		it("extracts sector from XML", () => {
			const result = parser.parseIATIXml(SAMPLE_IATI_XML);
			expect(result.data[0].sector).toBe("Humanitarian");
		});
	});
});

describe("GAC Mapper", () => {
	const parser = new GACParser();
	const projects = parser.parseProjectBrowser(SAMPLE_PROJECT_CSV).data;

	describe("extractPartners", () => {
		it("extracts unique partners across projects", () => {
			const partners = extractPartners(projects);
			expect(partners.size).toBeGreaterThanOrEqual(8);
		});

		it("aggregates partner budget and project counts", () => {
			const partners = extractPartners(projects);
			const wfp = partners.get("World Food Programme");
			expect(wfp).toBeDefined();
			expect(wfp!.projectCount).toBeGreaterThanOrEqual(1);
			expect(wfp!.totalBudget).toBeGreaterThanOrEqual(28500000);
		});

		it("tracks countries per partner", () => {
			const partners = extractPartners(projects);
			const undp = partners.get("United Nations Development Programme");
			expect(undp).toBeDefined();
			expect(undp!.countries.size).toBeGreaterThanOrEqual(1);
		});
	});

	describe("extractCountries", () => {
		it("extracts country summaries", () => {
			const countries = extractCountries(projects);
			expect(countries.size).toBeGreaterThanOrEqual(5);
		});

		it("aggregates country budgets", () => {
			const countries = extractCountries(projects);
			const ukraine = countries.get("Ukraine");
			expect(ukraine).toBeDefined();
			expect(ukraine!.totalBudget).toBe(45000000 + 35000000);
			expect(ukraine!.projectCount).toBe(2);
		});
	});

	describe("categorizePartners", () => {
		it("categorizes partners by type", () => {
			const allPartners = projects.flatMap((p) => p.implementingPartners);
			const categories = categorizePartners(allPartners);

			expect(categories.has("UN Agency")).toBe(true);
			expect(categories.has("NGO")).toBe(true);
		});

		it("identifies UN agencies correctly", () => {
			const allPartners = projects.flatMap((p) => p.implementingPartners);
			const categories = categorizePartners(allPartners);
			const unPartners = categories.get("UN Agency") ?? [];
			const unNames = unPartners.map((p) => p.name);
			expect(unNames).toContain("UNICEF");
			expect(unNames).toContain("World Food Programme");
		});
	});

	describe("groupByPartner", () => {
		it("groups projects by partner name", () => {
			const groups = groupByPartner(projects);
			const undp = groups.get("United Nations Development Programme");
			expect(undp).toBeDefined();
			expect(undp!.length).toBeGreaterThanOrEqual(2); // Ukraine + Colombia
		});
	});
});
