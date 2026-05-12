import { describe, expect, it } from "vitest";
import {
  extractClients,
  extractLobbyists,
  extractOfficials,
  extractRelationships,
} from "./mapper";
import { LobbyingParser } from "./parser";

// Realistic Commissioner of Lobbying registration CSV
const SAMPLE_REGISTRATION_CSV = `filing_number,registrant_name,registrant_firm,client_name,client_org_id,subject_matter,start_date,end_date,activities,institution,province,communications
"LR-2023-00142","Sarah Mitchell","Hill+Knowlton Strategies","Lockheed Martin Canada Corp",ORG-4521,"Defence procurement policy regarding the Future Fighter Capability Project",2023-01-15,2024-01-14,"Legislative proposal review;Government relations;Policy consultation","National Defence",ON,""
"LR-2023-00234","James Richardson","Foley & Lardner LLP","Suncor Energy",ORG-8832,"Environmental regulatory framework and carbon pricing policy",2023-03-01,2024-02-29,"Regulatory affairs;Policy consultation","Environment and Climate Change Canada",AB,""
"LR-2023-00356","Marie-Claire Dupont","" ,"Power Corporation of Canada",ORG-1156,"Financial services regulation and banking reform",2023-02-01,2024-01-31,"Legislative proposal review;Government relations","Department of Finance Canada",QC,""
"LR-2023-00478","Robert Chen","Earnscliffe Strategies","Telus Corporation",ORG-3341,"Telecommunications policy and spectrum allocation",2023-04-01,2024-03-31,"Government relations;Policy consultation;Stakeholder engagement","Innovation Science and Economic Development Canada",BC,""
"LR-2023-00512","Amanda Torres","Navigator Ltd","Pfizer Canada",ORG-7723,"Pharmaceutical policy and drug pricing regulations",2023-05-01,2024-04-30,"Regulatory affairs;Policy consultation","Health Canada",ON,""
"LR-2023-00623","David MacDonald","" ,"Canadian Bankers Association",ORG-9901,"Banking regulation and consumer financial protection",2023-06-01,2024-05-31,"Legislative proposal review;Government relations;Stakeholder engagement","Department of Finance Canada",ON,""
"LR-2023-00734","Lisa Park","Global Public Affairs","Sobeys Inc",ORG-5567,"Agricultural policy and supply chain regulations",2023-07-01,2024-06-30,"Policy consultation;Government relations","Agriculture and Agri-Food Canada",NS,""
"LR-2023-00845","François Belanger"," NATIONAL Public Relations","Hydro-Québec",ORG-2289,"Energy policy and green infrastructure funding programs",2023-03-15,2024-03-14,"Government relations;Policy consultation;Regulatory affairs","Natural Resources Canada",QC,""`;

const SAMPLE_COMMUNICATION_CSV = `filing_number,communication_date,communication_type,subject_matter,officials,institution
"LR-2023-00142",2023-06-15,meeting,"Discussion of Future Fighter Capability Project timeline","Minister of National Defence|Assistant Deputy Minister (Acquisition)",National Defence
"LR-2023-00142",2023-07-22,call,"Follow-up on defence procurement requirements","Director General Aerospace Equipment Program Management",National Defence
"LR-2023-00234",2023-08-10,meeting,"Environmental assessment regulations consultation","Deputy Minister of Environment|Senior Policy Advisor",Environment and Climate Change Canada
"LR-2023-00512",2023-09-05,meeting,"Patented Medicine Prices Review Board consultation","Associate Assistant Deputy Minister Health Products and Food Branch",Health Canada
"LR-2023-00478",2023-09-18,email,"Spectrum auction policy framework comments","Director Spectrum Management Operations",Innovation Science and Economic Development Canada
"LR-2023-00845",2023-10-02,conference,"Green energy transition panel discussion at Energy Council event","Assistant Deputy Minister Energy Sector",Natural Resources Canada
"LR-2023-00623",2023-10-15,meeting,"Open banking framework consultation","Associate Deputy Minister Financial Sector Policy",Department of Finance Canada
"LR-2023-00356",2023-11-01,letter,"Written submission on proposed financial consumer protection amendments","Director Financial Institutions Division",Department of Finance Canada`;

describe("LobbyingParser", () => {
  const parser = new LobbyingParser();

  describe("parseRegistrations", () => {
    it("parses registration CSV into LobbyingFiling objects", () => {
      const result = parser.parseRegistrations(SAMPLE_REGISTRATION_CSV);
      expect(result.data).toHaveLength(8);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.source).toBe("lobbying_commissioner");
      expect(result.metadata.format).toBe("csv");
    });

    it("extracts registrant names", () => {
      const result = parser.parseRegistrations(SAMPLE_REGISTRATION_CSV);
      expect(result.data[0].registrant.name).toBe("Sarah Mitchell");
      expect(result.data[0].registrant.firmName).toBe(
        "Hill+Knowlton Strategies",
      );
    });

    it("handles lobbyists without firms", () => {
      const result = parser.parseRegistrations(SAMPLE_REGISTRATION_CSV);
      // Marie-Claire Dupont has empty firm
      const marie = result.data.find(
        (f) => f.registrant.name === "Marie-Claire Dupont",
      );
      expect(marie).toBeDefined();
      expect(marie!.registrant.firmName).toBeUndefined();
    });

    it("extracts client names", () => {
      const result = parser.parseRegistrations(SAMPLE_REGISTRATION_CSV);
      expect(result.data[0].clientName).toBe("Lockheed Martin Canada Corp");
      expect(result.data[1].clientName).toBe("Suncor Energy");
    });

    it("parses activities from semicolons", () => {
      const result = parser.parseRegistrations(SAMPLE_REGISTRATION_CSV);
      expect(result.data[0].activities).toContain(
        "Legislative proposal review",
      );
      expect(result.data[0].activities).toContain("Government relations");
      expect(result.data[0].activities).toContain("Policy consultation");
    });

    it("maps institutions correctly", () => {
      const result = parser.parseRegistrations(SAMPLE_REGISTRATION_CSV);
      expect(result.data[0].institution).toBe("National Defence");
      expect(result.data[1].institution).toBe(
        "Environment and Climate Change Canada",
      );
    });

    it("generates valid UUIDs", () => {
      const result = parser.parseRegistrations(SAMPLE_REGISTRATION_CSV);
      for (const filing of result.data) {
        expect(filing.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      }
    });

    it("preserves raw data", () => {
      const result = parser.parseRegistrations(SAMPLE_REGISTRATION_CSV);
      expect(result.data[0].rawData.filing_number).toBe("LR-2023-00142");
    });
  });

  describe("parseCommunications", () => {
    it("parses communication report CSV", () => {
      const result = parser.parseCommunications(SAMPLE_COMMUNICATION_CSV);
      expect(result.data).toHaveLength(8);
      expect(result.errors).toHaveLength(0);
    });

    it("maps communication types", () => {
      const result = parser.parseCommunications(SAMPLE_COMMUNICATION_CSV);
      expect(result.data[0].type).toBe("meeting");
      expect(result.data[1].type).toBe("call");
      expect(result.data[4].type).toBe("email");
      expect(result.data[7].type).toBe("letter");
      expect(result.data[5].type).toBe("conference");
    });

    it("parses pipe-separated officials", () => {
      const result = parser.parseCommunications(SAMPLE_COMMUNICATION_CSV);
      expect(result.data[0].officials).toHaveLength(2);
      expect(result.data[0].officials).toContain(
        "Minister of National Defence",
      );
      expect(result.data[0].officials).toContain(
        "Assistant Deputy Minister (Acquisition)",
      );
    });

    it("extracts subject matter", () => {
      const result = parser.parseCommunications(SAMPLE_COMMUNICATION_CSV);
      expect(result.data[0].subjectMatter).toContain(
        "Future Fighter Capability",
      );
    });
  });
});

describe("Lobbying Mapper", () => {
  const parser = new LobbyingParser();
  const filings = parser.parseRegistrations(SAMPLE_REGISTRATION_CSV).data;
  const comms = parser.parseCommunications(SAMPLE_COMMUNICATION_CSV).data;

  describe("extractLobbyists", () => {
    it("extracts unique lobbyists", () => {
      const lobbyists = extractLobbyists(filings);
      expect(lobbyists.size).toBe(8);
    });

    it("tracks filing counts", () => {
      const lobbyists = extractLobbyists(filings);
      const sarah = lobbyists.get("Sarah Mitchell");
      expect(sarah).toBeDefined();
      expect(sarah!.filingCount).toBe(1);
    });

    it("tracks institutions", () => {
      const lobbyists = extractLobbyists(filings);
      const sarah = lobbyists.get("Sarah Mitchell");
      expect(sarah!.institutions.has("National Defence")).toBe(true);
    });
  });

  describe("extractClients", () => {
    it("extracts unique clients", () => {
      const clients = extractClients(filings);
      expect(clients.size).toBe(8);
    });

    it("tracks client details", () => {
      const clients = extractClients(filings);
      const lockheed = clients.get("Lockheed Martin Canada Corp");
      expect(lockheed).toBeDefined();
      expect(lockheed!.filingCount).toBe(1);
    });
  });

  describe("extractOfficials", () => {
    it("extracts government officials from communications", () => {
      const officials = extractOfficials(comms);
      expect(officials.size).toBeGreaterThanOrEqual(5);
    });

    it("tracks meeting counts per official", () => {
      const officials = extractOfficials(comms);
      // Check that officials have meeting data
      for (const [name, summary] of officials) {
        expect(summary.meetingCount).toBeGreaterThanOrEqual(1);
        expect(summary.name).toBeTruthy();
      }
    });
  });

  describe("extractRelationships", () => {
    it("builds lobbyist-client-institution triples", () => {
      const rels = extractRelationships(filings);
      expect(rels).toHaveLength(8);
      expect(rels[0].lobbyist).toBe("Sarah Mitchell");
      expect(rels[0].client).toBe("Lockheed Martin Canada Corp");
      expect(rels[0].institution).toBe("National Defence");
    });
  });
});
