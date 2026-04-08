import { describe, expect, it } from "vitest";
import { extractDepartments, extractVendors, groupByVendor } from "./mapper";
import { SpendingParser } from "./parser";

// Realistic CanadaBuys proactive disclosure CSV format
const SAMPLE_CONTRACT_CSV = `contract_number,title,vendor_name,vendor_id,department,contract_value,start_date,end_date,status,sole_source,province,commodity_type,description
"PW-22-01014500","Network Infrastructure Upgrade","Lockheed Martin Canada",VND001,"National Defence",2500000.00,2022-04-01,2023-03-31,completed,no,ON,"Telecommunications","Upgrade of secure network infrastructure for CFB Halifax"
"PW-23-01024688","Vehicle Fleet Maintenance","General Dynamics Land Systems",VND002,"National Defence",875000.00,2023-01-15,2024-01-14,active,yes,ON,"Vehicles","Maintenance services for LAV 6.0 fleet"
"EW-023-01034992","Cloud Hosting Services","Amazon Web Services Canada",VND003,"Shared Services Canada",4500000.00,2023-06-01,,active,no,ON,"IT Services","Enterprise cloud hosting for GCdigital platform"
"PW-23-01045010","Office Furniture Procurement","Haworth Ltd",VND004,"Employment and Social Development Canada",325000.00,2023-03-01,2023-09-30,completed,no,ON,"Furniture","Ergonomic office furniture for regional offices"
"PW-22-01055123","Translation Services","Lionbridge Technologies",VND005,"Public Services and Procurement Canada",680000.00,2022-10-01,2024-09-30,active,yes,NB,"Professional Services","Official languages translation for federal departments"
"PW-23-01065234","Cybersecurity Assessment","Bell Canada",VND006,"Communications Security Establishment",1200000.00,2023-07-15,2024-07-14,active,no,ON,"IT Security","Annual cybersecurity threat assessment for critical infrastructure"
"PW-22-01075345","Ship Repair Services","Seaspan Shipyards",VND007,"National Defence",3200000.00,2022-01-01,2024-12-31,active,no,BC,"Ship Repair","Minor refit and maintenance of Halifax-class frigates"
"PW-23-01085456","Medical Supplies","McKesson Canada",VND008,"Veterans Affairs Canada",540000.00,2023-04-01,,active,no,QC,"Medical Supplies","Pharmaceutical and medical supply chain for VA hospitals"
"PW-23-01095567","Software Licensing","Microsoft Canada",VND009,"Shared Services Canada",8900000.00,2023-01-01,2025-12-31,active,no,ON,"Software","Enterprise Microsoft 365 and Azure licensing for Government of Canada"
"PW-22-01105678","Construction Management","PCL Construction",VND010,"Public Services and Procurement Canada",5600000.00,2022-06-01,2025-05-31,active,no,AB,"Construction","Parliament Hill Centre Block rehabilitation project"`;

const SAMPLE_TENDER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<notices>
  <tender>
    <solicitation_number>PW-23-01060001</solicitation_number>
    <title>Fighter Jet Maintenance Support</title>
    <description>Request for Proposal for ongoing maintenance of CF-18 Hornet fleet avionics systems</description>
    <department>National Defence</department>
    <estimated_value>15000000.00</estimated_value>
    <currency>CAD</currency>
    <publish_date>2023-09-15</publish_date>
    <closing_date>2023-11-30</closing_date>
    <status>open</status>
    <sole_source>no</sole_source>
    <province>ON</province>
  </tender>
  <tender>
    <solicitation_number>PW-23-01060002</solicitation_number>
    <title>Indigenous Consultation Services</title>
    <description>Standing offer for Indigenous consultation and engagement advisory services</description>
    <department>Crown-Indigenous Relations and Northern Affairs</department>
    <estimated_value>750000.00</estimated_value>
    <currency>CAD</currency>
    <publish_date>2023-10-01</publish_date>
    <closing_date>2023-12-15</closing_date>
    <status>open</status>
    <sole_source>no</sole_source>
    <province>National Capital Region</province>
  </tender>
  <tender>
    <solicitation_number>PW-23-01060003</solicitation_number>
    <title>Data Centre Cooling System</title>
    <description>Sole-source contract for emergency cooling system replacement at Borden data centre</description>
    <department>Shared Services Canada</department>
    <estimated_value>2300000.00</estimated_value>
    <currency>CAD</currency>
    <publish_date>2023-08-20</publish_date>
    <closing_date>2023-08-21</closing_date>
    <status>awarded</status>
    <sole_source>yes</sole_source>
    <province>ON</province>
  </tender>
</notices>`;

describe("SpendingParser", () => {
	const parser = new SpendingParser();

	describe("parseProactiveDisclosure", () => {
		it("parses CSV data into Contract objects", () => {
			const result = parser.parseProactiveDisclosure(SAMPLE_CONTRACT_CSV);

			expect(result.data).toHaveLength(10);
			expect(result.errors).toHaveLength(0);
			expect(result.metadata.source).toBe("open_canada_contracts");
			expect(result.metadata.format).toBe("csv");
			expect(result.metadata.totalRows).toBe(10);
		});

		it("maps vendor names correctly", () => {
			const result = parser.parseProactiveDisclosure(SAMPLE_CONTRACT_CSV);
			expect(result.data[0].vendorName).toBe("Lockheed Martin Canada");
			expect(result.data[1].vendorName).toBe("General Dynamics Land Systems");
			expect(result.data[2].vendorName).toBe("Amazon Web Services Canada");
		});

		it("parses contract values correctly", () => {
			const result = parser.parseProactiveDisclosure(SAMPLE_CONTRACT_CSV);
			expect(result.data[0].value).toBe(2500000);
			expect(result.data[1].value).toBe(875000);
			expect(result.data[8].value).toBe(8900000);
		});

		it("maps contract statuses", () => {
			const result = parser.parseProactiveDisclosure(SAMPLE_CONTRACT_CSV);
			expect(result.data[0].status).toBe("completed");
			expect(result.data[1].status).toBe("active");
		});

		it("parses sole source flags", () => {
			const result = parser.parseProactiveDisclosure(SAMPLE_CONTRACT_CSV);
			expect(result.data[0].isSoleSource).toBe(false);
			expect(result.data[1].isSoleSource).toBe(true);
		});

		it("sets currency to CAD", () => {
			const result = parser.parseProactiveDisclosure(SAMPLE_CONTRACT_CSV);
			for (const contract of result.data) {
				expect(contract.currency).toBe("CAD");
			}
		});

		it("generates UUIDs for each contract", () => {
			const result = parser.parseProactiveDisclosure(SAMPLE_CONTRACT_CSV);
			const ids = result.data.map((c) => c.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(10);
			for (const id of ids) {
				expect(id).toMatch(
					/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
				);
			}
		});

		it("preserves raw data", () => {
			const result = parser.parseProactiveDisclosure(SAMPLE_CONTRACT_CSV);
			expect(result.data[0].rawData.vendor_name).toBe("Lockheed Martin Canada");
			expect(result.data[0].rawData.department).toBe("National Defence");
		});
	});

	describe("parseTenderNotice", () => {
		it("parses XML tender notices", () => {
			const result = parser.parseTenderNotice(SAMPLE_TENDER_XML);

			expect(result.data).toHaveLength(3);
			expect(result.errors).toHaveLength(0);
			expect(result.metadata.format).toBe("xml");
		});

		it("extracts tender fields correctly", () => {
			const result = parser.parseTenderNotice(SAMPLE_TENDER_XML);
			expect(result.data[0].solicitationNumber).toBe("PW-23-01060001");
			expect(result.data[0].title).toBe("Fighter Jet Maintenance Support");
			expect(result.data[0].department).toBe("National Defence");
			expect(result.data[0].estimatedValue).toBe(15000000);
		});

		it("maps tender statuses", () => {
			const result = parser.parseTenderNotice(SAMPLE_TENDER_XML);
			expect(result.data[0].status).toBe("open");
			expect(result.data[2].status).toBe("awarded");
		});

		it("parses sole source from XML", () => {
			const result = parser.parseTenderNotice(SAMPLE_TENDER_XML);
			expect(result.data[0].isSoleSource).toBe(false);
			expect(result.data[2].isSoleSource).toBe(true);
		});
	});

	describe("normalizeContract", () => {
		it("handles missing optional fields", () => {
			const p = new SpendingParser();
			const result = p.parseProactiveDisclosure(
				"contract_number,title,vendor_name,department,contract_value,start_date,status\n" +
					'PW-01,"Test Contract","Test Vendor","Test Dept",1000,2023-01-01,active',
			);
			expect(result.data).toHaveLength(1);
			expect(result.data[0].endDate).toBeUndefined();
			expect(result.data[0].vendorId).toBeUndefined();
			expect(result.data[0].province).toBeUndefined();
		});
	});
});

describe("Spending Mapper", () => {
	const parser = new SpendingParser();
	const contracts = parser.parseProactiveDisclosure(SAMPLE_CONTRACT_CSV).data;

	describe("extractVendors", () => {
		it("extracts unique vendors with counts", () => {
			const vendors = extractVendors(contracts);
			expect(vendors.size).toBe(10); // all unique vendors
		});

		it("aggregates vendor values", () => {
			const vendors = extractVendors(contracts);
			const lockheed = vendors.get("Lockheed Martin Canada");
			expect(lockheed).toBeDefined();
			expect(lockheed!.contractCount).toBe(1);
			expect(lockheed!.totalValue).toBe(2500000);
		});

		it("tracks department interactions", () => {
			const vendors = extractVendors(contracts);
			const lockheed = vendors.get("Lockheed Martin Canada");
			expect(lockheed!.departmentInteractions.has("National Defence")).toBe(
				true,
			);
		});
	});

	describe("extractDepartments", () => {
		it("extracts unique departments", () => {
			const depts = extractDepartments(contracts);
			expect(depts.size).toBeGreaterThanOrEqual(5);
		});

		it("aggregates department spending", () => {
			const depts = extractDepartments(contracts);
			const defence = depts.get("National Defence");
			expect(defence).toBeDefined();
			expect(defence!.contractCount).toBe(3); // 3 National Defence contracts
			expect(defence!.totalValue).toBe(2500000 + 875000 + 3200000);
		});
	});

	describe("groupByVendor", () => {
		it("groups contracts by vendor", () => {
			const groups = groupByVendor(contracts);
			expect(groups.size).toBe(10);
			for (const [, list] of groups) {
				expect(list.length).toBeGreaterThanOrEqual(1);
			}
		});
	});
});
