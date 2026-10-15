/**
 * Attribution-notice regression tests.
 *
 * The site footer and the /data-sources page carry licence statements and
 * disclaimers that are compliance-relevant. These tests pin:
 *
 *   1. the exact required wording of the OGL–Canada and lobbying statements;
 *   2. that the footer renders the statement and non-endorsement disclaimer
 *      (via the shared constants module);
 *   3. that the /data-sources page documents the notices and source links.
 *
 * Incident rule: no attribution/notice change ships without this test.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  OGL_CANADA_ATTRIBUTION_STATEMENT,
  OGL_CANADA_ATTRIBUTION_STATEMENT_FR,
  NON_ENDORSEMENT_DISCLAIMER,
  NON_ENDORSEMENT_DISCLAIMER_FR,
  LOBBYING_ODLA_ATTRIBUTION_STATEMENT,
  HOC_TERMS_URL,
  SENATE_IP_URL,
} from "../attribution-notices";

const layoutPath = fileURLToPath(new URL("../../layouts/BaseLayout.astro", import.meta.url));
const dataSourcesPath = fileURLToPath(new URL("../../pages/data-sources.astro", import.meta.url));
const layout = readFileSync(layoutPath, "utf8");
const dataSources = readFileSync(dataSourcesPath, "utf8");

describe("attribution notices", () => {
  test("OGL–Canada statement matches the licence's required wording (EN + FR)", () => {
    expect(OGL_CANADA_ATTRIBUTION_STATEMENT).toBe(
      "Contains information licensed under the Open Government Licence – Canada.",
    );
    expect(OGL_CANADA_ATTRIBUTION_STATEMENT_FR).toBe(
      "Contient de l'information visée par la Licence du gouvernement ouvert – Canada.",
    );
  });

  test("the footer renders the OGL–Canada statement, the data-sources link, and the non-endorsement disclaimer", () => {
    expect(layout).toContain("OGL_CANADA_ATTRIBUTION_STATEMENT");
    expect(layout).toContain("NON_ENDORSEMENT_DISCLAIMER");
    expect(layout).toContain("/data-sources");
  });

  test("the data-sources page carries statements, notices, and source links", () => {
    expect(dataSources).toContain("OGL_CANADA_LICENCE_URL");
    expect(dataSources).toContain("LOBBYING_ODLA_ATTRIBUTION_STATEMENT");
    expect(dataSources).toContain("STATCAN_SOURCE_NOTICE");
    expect(dataSources).toContain("HOC_TERMS_URL");
    expect(dataSources).toContain("SENATE_IP_URL");
    expect(dataSources).toContain("NON_ENDORSEMENT_DISCLAIMER");
    expect(dataSources).toContain("not legal advice");
  });

  test("lobbying statement matches the licence's required wording", () => {
    expect(LOBBYING_ODLA_ATTRIBUTION_STATEMENT).toBe(
      "Contains information licensed under the Open Data Licence Agreement — Office of the Commissioner of Lobbying.",
    );
  });

  test("required source-link URLs are the canonical terms pages", () => {
    expect(HOC_TERMS_URL).toBe("https://www.ourcommons.ca/en/important-notices");
    expect(SENATE_IP_URL).toBe("https://sencanada.ca/en/intellectual-property");
  });
});
