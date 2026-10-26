// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("unesco-uis Module", () => {
  // ── Module loading tests ──

  it("constants module loads with correct exports", async () => {
    const constantsMod = await import("../constants.js");
    assert.ok(constantsMod, "constants should load");
    assert.ok(constantsMod.UNESCO_UIS_BASE_URL, "should export UNESCO_UIS_BASE_URL");
    assert.ok(constantsMod.UNESCO_SDMX_BASE_URL, "should export UNESCO_SDMX_BASE_URL");
    assert.ok(constantsMod.UNESCO_DATASETS, "should export UNESCO_DATASETS");
    assert.ok(Array.isArray(constantsMod.UNESCO_DATASETS), "UNESCO_DATASETS should be an array");
    assert.ok(constantsMod.UNESCO_DATASETS.length > 0, "UNESCO_DATASETS should not be empty");
    assert.equal(typeof constantsMod.validateDatasetId, "function", "should export validateDatasetId");
    assert.equal(typeof constantsMod.buildDatasetUrl, "function", "should export buildDatasetUrl");
  });

  it("types module loads correctly", async () => {
    const typesMod = await import("../types.js");
    assert.ok(typesMod, "types should load");
    // UnescoApiError is a class, should be constructable
    assert.equal(typeof typesMod.UnescoApiError, "function", "should export UnescoApiError class");
  });

  it("parser module loads and exports functions", async () => {
    const parserMod = await import("../parser.js");
    assert.ok(parserMod, "parser should load");
    assert.equal(typeof parserMod.parseSdmxResponse, "function", "should export parseSdmxResponse");
    assert.equal(typeof parserMod.parseSdmxJsonText, "function", "should export parseSdmxJsonText");
    assert.equal(typeof parserMod.parseObservation, "function", "should export parseObservation");
    assert.equal(typeof parserMod.classifyObsStatus, "function", "should export classifyObsStatus");
  });

  it("api module loads and exports functions", async () => {
    const apiMod = await import("../api.js");
    assert.ok(apiMod, "api should load");
    assert.equal(typeof apiMod.fetchUnescoDataset, "function", "should export fetchUnescoDataset");
    assert.equal(typeof apiMod.healthCheck, "function", "should export healthCheck");
  });

  it("index module exports the expected public API", async () => {
    const indexMod = await import("../index.js");
    const keys = Object.keys(indexMod);
    assert.ok(keys.length > 0, "index should export at least one item");

    // Core ingestion functions
    assert.equal(typeof indexMod.ingestUnescoDataset, "function", "should export ingestUnescoDataset");
    assert.equal(typeof indexMod.ingestAllUnesco, "function", "should export ingestAllUnesco");
    assert.equal(typeof indexMod.ingestByTopic, "function", "should export ingestByTopic");
    assert.equal(typeof indexMod.searchUnescoRecords, "function", "should export searchUnescoRecords");

    // Re-exports from submodules
    assert.equal(typeof indexMod.parseSdmxResponse, "function", "should re-export parseSdmxResponse");
    assert.equal(typeof indexMod.fetchUnescoDataset, "function", "should re-export fetchUnescoDataset");
    assert.equal(typeof indexMod.classifyObsStatus, "function", "should re-export classifyObsStatus");
    assert.equal(typeof indexMod.validateDatasetId, "function", "should re-export validateDatasetId");
  });

  // ── Parser functional tests ──

  describe("classifyObsStatus", () => {
    it("maps known status codes correctly", async () => {
      const { classifyObsStatus } = await import("../parser.js");
      assert.equal(classifyObsStatus("A"), "Official");
      assert.equal(classifyObsStatus("E"), "Estimated");
      assert.equal(classifyObsStatus("F"), "Forecast");
      assert.equal(classifyObsStatus("I"), "Imputed");
      assert.equal(classifyObsStatus("P"), "Provisional");
      assert.equal(classifyObsStatus("M"), "Missing");
      assert.equal(classifyObsStatus("S"), "Adjusted");
      assert.equal(classifyObsStatus("D"), "Discontinued");
      assert.equal(classifyObsStatus("L"), "Missing value");
    });

    it("returns unknown for undefined or unrecognized codes", async () => {
      const { classifyObsStatus } = await import("../parser.js");
      assert.equal(classifyObsStatus(undefined), "unknown");
      assert.equal(classifyObsStatus("Z"), "unknown");
      assert.equal(classifyObsStatus(""), "unknown");
    });
  });

  describe("parseSdmxJsonText", () => {
    it("returns empty array for empty input", async () => {
      const { parseSdmxJsonText } = await import("../parser.js");
      const result = await parseSdmxJsonText("", "EDULIT_DS", "Education Literacy");
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it("returns empty array for whitespace-only input", async () => {
      const { parseSdmxJsonText } = await import("../parser.js");
      const result = await parseSdmxJsonText("   ", "EDULIT_DS", "Education Literacy");
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it("returns empty array for SDMX with no dataSets", async () => {
      const { parseSdmxJsonText } = await import("../parser.js");
      const sdmx = JSON.stringify({
        structure: {
          dimensions: { series: [], observation: [] },
          attributes: { observation: [], series: [] },
        },
      });
      const result = await parseSdmxJsonText(sdmx, "EDULIT_DS", "Education Literacy");
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it("parses a minimal SDMX-JSON response with observations", async () => {
      const { parseSdmxJsonText } = await import("../parser.js");
      const sdmx = JSON.stringify({
        structure: {
          dimensions: {
            series: [
              {
                id: "REF_AREA",
                name: "Reference Area",
                values: [{ id: "CAN", name: "Canada" }],
              },
              {
                id: "INDICATOR",
                name: "Indicator",
                values: [{ id: "SE_ADT_LITR_ZS", name: "Adult literacy rate" }],
              },
            ],
            observation: [
              {
                id: "TIME_PERIOD",
                name: "Time Period",
                values: [{ id: "2020", name: "2020" }],
              },
            ],
          },
          attributes: {
            observation: [
              {
                id: "UNIT",
                name: "Unit",
                values: [{ id: "PT", name: "Percentage" }],
              },
              {
                id: "OBS_STATUS",
                name: "Observation Status",
                values: [{ id: "A", name: "Official" }],
              },
            ],
            series: [],
          },
        },
        dataSets: [
          {
            series: {
              "0:0": {
                observations: {
                  "0": [99.0, 0],
                },
                attributes: [0],
              },
            },
          },
        ],
      });

      const result = await parseSdmxJsonText(sdmx, "EDULIT_DS", "Education Literacy");
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 1, "should extract 1 record");

      const record = result[0];
      assert.equal(record.country, "CAN");
      assert.equal(record.indicatorCode, "SE_ADT_LITR_ZS");
      assert.equal(record.indicatorName, "Adult literacy rate");
      assert.equal(record.year, 2020);
      assert.equal(record.value, 99.0);
      assert.equal(record.datasetId, "EDULIT_DS");
      assert.equal(record.datasetName, "Education Literacy");
      assert.ok(typeof record.id === "string", "id should be string");
      assert.equal(record.id.length, 64, "id should be 64-char SHA-256");
    });

    it("filters out non-numeric observation values", async () => {
      const { parseSdmxJsonText } = await import("../parser.js");
      const sdmx = JSON.stringify({
        structure: {
          dimensions: {
            series: [
              { id: "REF_AREA", name: "Area", values: [{ id: "CAN", name: "Canada" }] },
              { id: "INDICATOR", name: "Indicator", values: [{ id: "X", name: "Test" }] },
            ],
            observation: [
              { id: "TIME_PERIOD", name: "Time", values: [{ id: "2020", name: "2020" }] },
            ],
          },
          attributes: { observation: [], series: [] },
        },
        dataSets: [
          {
            series: {
              "0:0": {
                observations: {
                  "0": ["not-a-number"],
                },
              },
            },
          },
        ],
      });

      const result = await parseSdmxJsonText(sdmx, "SCN_DS", "Science");
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0, "should filter out non-numeric values");
    });

    it("skips observations with unresolvable time periods", async () => {
      const { parseSdmxJsonText } = await import("../parser.js");
      const sdmx = JSON.stringify({
        structure: {
          dimensions: {
            series: [
              { id: "REF_AREA", name: "Area", values: [{ id: "CAN", name: "Canada" }] },
              { id: "INDICATOR", name: "Indicator", values: [{ id: "X", name: "Test" }] },
            ],
            observation: [],
          },
          attributes: { observation: [], series: [] },
        },
        dataSets: [
          {
            series: {
              "0:0": {
                observations: {
                  "99": [42.0],
                },
              },
            },
          },
        ],
      });

      const result = await parseSdmxJsonText(sdmx, "CLT_DS", "Culture");
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0, "should skip obs with unresolvable time");
    });
  });

  describe("parseObservation", () => {
    it("creates record with SHA-256 ID", async () => {
      const { parseObservation } = await import("../parser.js");
      const record = await parseObservation(
        "CAN",
        "SE_ADT_LITR_ZS",
        "Adult literacy rate",
        2020,
        99.0,
        "PT",
        "A",
        "EDULIT_DS",
        "Education Literacy",
      );

      assert.ok(typeof record.id === "string", "id should be string");
      assert.equal(record.id.length, 64, "id should be 64-char SHA-256");
      assert.equal(record.country, "CAN");
      assert.equal(record.indicatorCode, "SE_ADT_LITR_ZS");
      assert.equal(record.year, 2020);
      assert.equal(record.value, 99.0);
      assert.equal(record.obsStatus, "A");
    });

    it("produces deterministic IDs for same input", async () => {
      const { parseObservation } = await import("../parser.js");
      const r1 = await parseObservation("CAN", "X", "Y", 2020, 1.0, "PT", undefined, "DS", "Name");
      const r2 = await parseObservation("CAN", "X", "Y", 2020, 1.0, "PT", undefined, "DS", "Name");
      assert.equal(r1.id, r2.id, "same input should produce same SHA-256");
    });
  });

  // ── Constants tests ──

  describe("constants", () => {
    it("validateDatasetId accepts known datasets", async () => {
      const { validateDatasetId } = await import("../constants.js");
      assert.equal(validateDatasetId("EDULIT_DS"), true);
      assert.equal(validateDatasetId("SCN_DS"), true);
      assert.equal(validateDatasetId("CLT_DS"), true);
    });

    it("validateDatasetId rejects unknown datasets", async () => {
      const { validateDatasetId } = await import("../constants.js");
      assert.equal(validateDatasetId("FAKE_DS"), false);
      assert.equal(validateDatasetId(""), false);
    });

    it("buildDatasetUrl produces valid URL", async () => {
      const { buildDatasetUrl } = await import("../constants.js");
      const url = buildDatasetUrl("EDULIT_DS", "json", "CAN");
      assert.ok(url.includes("EDULIT_DS"), "URL should contain dataset ID");
      assert.ok(url.includes("format=json"), "URL should contain format");
      assert.ok(url.includes("CAN"), "URL should contain country code");
    });

    it("buildDatasetUrl throws for unknown dataset", async () => {
      const { buildDatasetUrl } = await import("../constants.js");
      assert.throws(() => buildDatasetUrl("NOPE_DS"), /Unknown dataset/);
    });
  });

  // ── Search tests ──

  describe("searchUnescoRecords", () => {
    it("matches records by indicator name (case-insensitive)", async () => {
      const { searchUnescoRecords, parseObservation } = await import("../index.js");
      const r1 = await parseObservation("CAN", "X1", "Adult Literacy Rate", 2020, 99, "PT", "A", "DS", "Edu");
      const r2 = await parseObservation("CAN", "X2", "R&D Expenditure", 2020, 3.2, "PT", "A", "DS", "Sci");

      const results = searchUnescoRecords([r1, r2], "literacy");
      assert.equal(results.length, 1);
      assert.equal(results[0].indicatorCode, "X1");
    });

    it("matches records by dataset name", async () => {
      const { searchUnescoRecords, parseObservation } = await import("../index.js");
      const r1 = await parseObservation("CAN", "X1", "Test", 2020, 1, "PT", "A", "DS", "Education Literacy");
      const r2 = await parseObservation("CAN", "X2", "Test", 2020, 2, "PT", "A", "DS", "Science Data");

      const results = searchUnescoRecords([r1, r2], "education");
      assert.equal(results.length, 1);
      assert.equal(results[0].datasetName, "Education Literacy");
    });

    it("returns empty array for no matches", async () => {
      const { searchUnescoRecords, parseObservation } = await import("../index.js");
      const r1 = await parseObservation("CAN", "X1", "Test", 2020, 1, "PT", "A", "DS", "Name");
      const results = searchUnescoRecords([r1], "quantum");
      assert.equal(results.length, 0);
    });
  });

  // ── UnescoApiError test ──

  describe("UnescoApiError", () => {
    it("is constructable and has correct name", async () => {
      const { UnescoApiError } = await import("../types.js");
      const err = new UnescoApiError("test error", "EDULIT_DS");
      assert.equal(err.name, "UnescoApiError");
      assert.equal(err.message, "test error");
      assert.equal(err.datasetId, "EDULIT_DS");
      assert.ok(err instanceof Error);
    });
  });
});
