import { describe, expect, it } from "vitest";
import {
  crossReferenceDonorsDisclosures,
  extractDisclosures,
  extractDonors,
  extractRecipients,
} from "./mapper";
import { CIECParser } from "./parser";

// Realistic CIEC public disclosure summary HTML
const SAMPLE_DISCLOSURE_HTML = `
<table>
  <tr>
    <td>The Honourable Anita Anand</td>
    <td>President of the Treasury Board</td>
    <td>Treasury Board of Canada Secretariat</td>
    <td>2024</td>
    <td>securities;Shares in Shopify Inc;$15,001 - $50,000|corporations;Directorship at Atlas Corp;|real_property;Rental property at 45 King Street, Toronto;$100,001 - $200,000</td>
    <td>ON</td>
    <td>2024-03-15</td>
  </tr>
  <tr>
    <td>The Honourable Chrystia Freeland</td>
    <td>Deputy Prime Minister and Minister of Finance</td>
    <td>Department of Finance Canada</td>
    <td>2024</td>
    <td>securities;Shares in Brookfield Asset Management;$50,001 - $100,000|securities;Shares in Royal Bank of Canada;$15,001 - $50,000|real_property;Residential property in Toronto;$500,001 - $1,000,000</td>
    <td>ON</td>
    <td>2024-03-20</td>
  </tr>
  <tr>
    <td>The Honourable Mélanie Joly</td>
    <td>Minister of Foreign Affairs</td>
    <td>Global Affairs Canada</td>
    <td>2024</td>
    <td>corporations;Ownership interest in Joly Communications Inc.;|securities;RRSP holdings in TD Canadian Index Fund;$15,001 - $50,000</td>
    <td>QC</td>
    <td>2024-04-01</td>
  </tr>
  <tr>
    <td>The Honourable Bill Blair</td>
    <td>Minister of National Defence</td>
    <td>National Defence</td>
    <td>2024</td>
    <td>liabilities;Mortgage on primary residence with RBC;$200,001 - $500,000|securities;Pension holdings in Canadian Equity Fund;$100,001 - $200,000</td>
    <td>ON</td>
    <td>2024-03-25</td>
  </tr>
  <tr>
    <td>The Honourable Marc Miller</td>
    <td>Minister of Immigration, Refugees and Citizenship</td>
    <td>Immigration, Refugees and Citizenship Canada</td>
    <td>2024</td>
    <td>real_property;Cottage property in Mont-Tremblant, QC;$200,001 - $500,000|partnerships;Limited partnership in Miller Family Holdings;</td>
    <td>QC</td>
    <td>2024-04-10</td>
  </tr>
</table>`;

// Realistic Elections Canada contribution XML
const SAMPLE_CONTRIBUTION_XML = `<?xml version="1.0" encoding="UTF-8"?>
<contributions>
  <contribution>
    <donor_name>Weston Family Foundation</donor_name>
    <donor_type>Corporation</donor_type>
    <donor_org_id>ORG-44521</donor_org_id>
    <recipient_name>Liberal Party of Canada</recipient_name>
    <recipient_type>political_party</recipient_type>
    <amount>50000.00</amount>
    <date>2023-06-15</date>
    <province>ON</province>
    <riding>Toronto Centre</riding>
  </contribution>
  <contribution>
    <donor_name>Shopify Inc</donor_name>
    <donor_type>Corporation</donor_type>
    <donor_org_id>ORG-33201</donor_org_id>
    <recipient_name>Liberal Party of Canada</recipient_name>
    <recipient_type>political_party</recipient_type>
    <amount>35000.00</amount>
    <date>2023-09-20</date>
    <province>ON</province>
    <riding>Ottawa Centre</riding>
  </contribution>
  <contribution>
    <donor_name>Pierre Poilievre</donor_name>
    <donor_type>Individual</donor_type>
    <donor_person_id>PER-78901</donor_person_id>
    <recipient_name>Conservative Party of Canada</recipient_name>
    <recipient_type>political_party</recipient_type>
    <amount>1700.00</amount>
    <date>2023-03-15</date>
    <province>ON</province>
    <riding>Carleton</riding>
  </contribution>
  <contribution>
    <donor_name>Jagmeet Singh</donor_name>
    <donor_type>Individual</donor_type>
    <donor_person_id>PER-67890</donor_person_id>
    <recipient_name>New Democratic Party</recipient_name>
    <recipient_type>political_party</recipient_type>
    <amount>1700.00</amount>
    <date>2023-05-10</date>
    <province>ON</province>
    <riding>Burnaby South</riding>
  </contribution>
  <contribution>
    <donor_name>Brookfield Asset Management</donor_name>
    <donor_type>Corporation</donor_type>
    <donor_org_id>ORG-11234</donor_org_id>
    <recipient_name>Liberal Party of Canada</recipient_name>
    <recipient_type>political_party</recipient_type>
    <amount>45000.00</amount>
    <date>2023-11-01</date>
    <province>ON</province>
    <riding>Toronto—St. Paul's</riding>
  </contribution>
  <contribution>
    <donor_name>Margaret Atwood</donor_name>
    <donor_type>Individual</donor_type>
    <donor_person_id>PER-54321</donor_person_id>
    <recipient_name>New Democratic Party</recipient_name>
    <recipient_type>political_party</recipient_type>
    <amount>1700.00</amount>
    <date>2023-08-22</date>
    <province>ON</province>
    <riding>Toronto—Danforth</riding>
  </contribution>
  <contribution>
    <donor_name>TELUS Corporation</donor_name>
    <donor_type>Corporation</donor_type>
    <donor_org_id>ORG-99887</donor_org_id>
    <recipient_name>Conservative Party of Canada</recipient_name>
    <recipient_type>political_party</recipient_type>
    <amount>25000.00</amount>
    <date>2023-04-18</date>
    <province>BC</province>
    <riding>Vancouver Centre</riding>
  </contribution>
  <contribution>
    <donor_name>Canadian Union of Public Employees</donor_name>
    <donor_type>Organization</donor_type>
    <donor_org_id>ORG-45678</donor_org_id>
    <recipient_name>New Democratic Party</recipient_name>
    <recipient_type>political_party</recipient_type>
    <amount>30000.00</recipient_type>
    <date>2023-07-05</date>
    <province>ON</province>
    <riding>Hamilton Centre</riding>
  </contribution>
</contributions>`;

describe("CIECParser", () => {
  describe("parseDisclosureSummary", () => {
    it("parses HTML table disclosure data", () => {
      const parser = new CIECParser();
      const result = parser.parseDisclosureSummary(SAMPLE_DISCLOSURE_HTML);

      expect(result.data).toHaveLength(5);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.source).toBe("disclosure_clerk");
      expect(result.metadata.format).toBe("html");
    });

    it("extracts person names", () => {
      const parser = new CIECParser();
      const result = parser.parseDisclosureSummary(SAMPLE_DISCLOSURE_HTML);
      expect(result.data[0].personName).toBe("The Honourable Anita Anand");
      expect(result.data[1].personName).toBe(
        "The Honourable Chrystia Freeland",
      );
    });

    it("extracts positions and departments", () => {
      const parser = new CIECParser();
      const result = parser.parseDisclosureSummary(SAMPLE_DISCLOSURE_HTML);
      expect(result.data[0].position).toBe("President of the Treasury Board");
      expect(result.data[0].department).toBe(
        "Treasury Board of Canada Secretariat",
      );
    });

    it("parses year correctly", () => {
      const parser = new CIECParser();
      const result = parser.parseDisclosureSummary(SAMPLE_DISCLOSURE_HTML);
      expect(result.data[0].year).toBe(2024);
    });

    it("parses interests from pipe-separated text", () => {
      const parser = new CIECParser();
      const result = parser.parseDisclosureSummary(SAMPLE_DISCLOSURE_HTML);
      // First disclosure has 3 interests
      expect(result.data[0].interests).toHaveLength(3);
      expect(result.data[0].interests[0].category).toBe("securities");
      expect(result.data[0].interests[0].description).toBe(
        "Shares in Shopify Inc",
      );
    });

    it("parses interest categories correctly", () => {
      const parser = new CIECParser();
      const result = parser.parseDisclosureSummary(SAMPLE_DISCLOSURE_HTML);
      const anand = result.data[0];
      expect(anand.interests[0].category).toBe("securities");
      expect(anand.interests[1].category).toBe("corporations");
      expect(anand.interests[2].category).toBe("real_property");
    });

    it("extracts provinces", () => {
      const parser = new CIECParser();
      const result = parser.parseDisclosureSummary(SAMPLE_DISCLOSURE_HTML);
      expect(result.data[0].province).toBe("ON");
      expect(result.data[2].province).toBe("QC");
    });

    it("generates valid UUIDs", () => {
      const parser = new CIECParser();
      const result = parser.parseDisclosureSummary(SAMPLE_DISCLOSURE_HTML);
      for (const d of result.data) {
        expect(d.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      }
    });
  });

  describe("parseContributions", () => {
    it("parses Elections Canada XML", () => {
      const parser = new CIECParser({ source: "elections_canada" });
      const result = parser.parseContributions(SAMPLE_CONTRIBUTION_XML);

      expect(result.data).toHaveLength(8);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.source).toBe("elections_canada");
      expect(result.metadata.format).toBe("xml");
    });

    it("extracts donor names", () => {
      const parser = new CIECParser();
      const result = parser.parseContributions(SAMPLE_CONTRIBUTION_XML);
      expect(result.data[0].donorName).toBe("Weston Family Foundation");
      expect(result.data[2].donorName).toBe("Pierre Poilievre");
    });

    it("identifies corporate vs individual donors", () => {
      const parser = new CIECParser();
      const result = parser.parseContributions(SAMPLE_CONTRIBUTION_XML);
      expect(result.data[0].isCorporate).toBe(true); // Weston Family Foundation
      expect(result.data[2].isCorporate).toBe(false); // Pierre Poilievre
      expect(result.data[7].isCorporate).toBe(true); // CUPE (Organization)
    });

    it("parses donation amounts", () => {
      const parser = new CIECParser();
      const result = parser.parseContributions(SAMPLE_CONTRIBUTION_XML);
      expect(result.data[0].amount).toBe(50000);
      expect(result.data[2].amount).toBe(1700);
    });

    it("extracts recipient names", () => {
      const parser = new CIECParser();
      const result = parser.parseContributions(SAMPLE_CONTRIBUTION_XML);
      expect(result.data[0].recipientName).toBe("Liberal Party of Canada");
      expect(result.data[6].recipientName).toBe("Conservative Party of Canada");
    });

    it("maps recipient types", () => {
      const parser = new CIECParser();
      const result = parser.parseContributions(SAMPLE_CONTRIBUTION_XML);
      for (const d of result.data) {
        expect(d.recipientType).toBe("political_party");
      }
    });

    it("extracts riding information", () => {
      const parser = new CIECParser();
      const result = parser.parseContributions(SAMPLE_CONTRIBUTION_XML);
      expect(result.data[0].riding).toBe("Toronto Centre");
      expect(result.data[2].riding).toBe("Carleton");
    });

    it("sets currency to CAD", () => {
      const parser = new CIECParser();
      const result = parser.parseContributions(SAMPLE_CONTRIBUTION_XML);
      for (const d of result.data) {
        expect(d.currency).toBe("CAD");
      }
    });
  });
});

describe("CIEC Mapper", () => {
  describe("extractDisclosures", () => {
    it("creates person summaries", () => {
      const parser = new CIECParser();
      const result = parser.parseDisclosureSummary(SAMPLE_DISCLOSURE_HTML);
      const summaries = extractDisclosures(result.data);

      expect(summaries.size).toBe(5);
      const anand = summaries.get("The Honourable Anita Anand");
      expect(anand).toBeDefined();
      expect(anand!.interestCount).toBe(3);
    });

    it("extracts interest categories", () => {
      const parser = new CIECParser();
      const result = parser.parseDisclosureSummary(SAMPLE_DISCLOSURE_HTML);
      const summaries = extractDisclosures(result.data);

      const anand = summaries.get("The Honourable Anita Anand");
      expect(anand!.categories.has("securities")).toBe(true);
      expect(anand!.categories.has("corporations")).toBe(true);
      expect(anand!.categories.has("real_property")).toBe(true);
    });
  });

  describe("extractDonors", () => {
    it("aggregates donor data", () => {
      const parser = new CIECParser();
      const result = parser.parseContributions(SAMPLE_CONTRIBUTION_XML);
      const donors = extractDonors(result.data);

      expect(donors.size).toBe(8);
    });

    it("tracks donation totals", () => {
      const parser = new CIECParser();
      const result = parser.parseContributions(SAMPLE_CONTRIBUTION_XML);
      const donors = extractDonors(result.data);

      const weston = donors.get("Weston Family Foundation");
      expect(weston).toBeDefined();
      expect(weston!.totalDonated).toBe(50000);
      expect(weston!.isCorporate).toBe(true);
    });
  });

  describe("extractRecipients", () => {
    it("aggregates recipient data", () => {
      const parser = new CIECParser();
      const result = parser.parseContributions(SAMPLE_CONTRIBUTION_XML);
      const recipients = extractRecipients(result.data);

      expect(recipients.size).toBe(3); // LPC, CPC, NDP
    });

    it("tracks total received per party", () => {
      const parser = new CIECParser();
      const result = parser.parseContributions(SAMPLE_CONTRIBUTION_XML);
      const recipients = extractRecipients(result.data);

      const liberal = recipients.get("Liberal Party of Canada");
      expect(liberal).toBeDefined();
      expect(liberal!.totalReceived).toBe(50000 + 35000 + 45000);
      expect(liberal!.donorCount).toBe(3);
    });
  });

  describe("crossReferenceDonorsDisclosures", () => {
    it("finds overlaps between donors and disclosed interests", () => {
      const parser = new CIECParser();
      const disclosures = parser.parseDisclosureSummary(
        SAMPLE_DISCLOSURE_HTML,
      ).data;
      const donations = parser.parseContributions(SAMPLE_CONTRIBUTION_XML).data;

      const conflicts = crossReferenceDonorsDisclosures(donations, disclosures);

      // Shopify Inc appears as both a donor and in Anand's disclosed securities
      // Brookfield appears as a donor and in Freeland's disclosed securities
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
    });
  });
});
