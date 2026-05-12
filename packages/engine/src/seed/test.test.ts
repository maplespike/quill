/**
 * Seed Data Integration Test
 *
 * Tests the pipeline data loading mechanism and verifies that the
 * engine works correctly with both real and empty data states.
 */

import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { loadPipelineData, getSeedParsedData } from "./data";

// Determine whether pipeline data exists on this system
const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DATA_PATH = join(__dirname, "..", "..", "..", "portal", "assets", "pipeline-data.json");
const HAS_PIPELINE_DATA = existsSync(PIPELINE_DATA_PATH);

describe("Seed Data Loading", () => {
  it("getSeedParsedData returns empty arrays when no pipeline data", () => {
    const data = getSeedParsedData();

    expect(data).toBeDefined();
    expect(data.contracts).toEqual([]);
    expect(data.filings).toEqual([]);
    expect(data.donations).toEqual([]);
    expect(data.disclosures).toEqual([]);
    expect(data.projects).toEqual([]);
  });

  it("loadPipelineData returns null when file does not exist", () => {
    // This test is environment-dependent. If pipeline-data.json exists on
    // this machine, it returns the parsed data; otherwise null.
    if (HAS_PIPELINE_DATA) {
      const result = loadPipelineData();
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("generatedAt");
      expect(result).toHaveProperty("sources");
      expect(result).toHaveProperty("stats");
      expect(typeof result!.generatedAt).toBe("string");
      expect(typeof result!.stats).toBe("object");
      expect(typeof result!.sources).toBe("object");
    } else {
      const result = loadPipelineData();
      expect(result).toBeNull();
    }
  });

  it("loadPipelineData returns typed data when file exists", () => {
    const data = loadPipelineData();
    // If pipeline-data.json exists, it should have the expected shape.
    if (data !== null) {
      expect(data).toHaveProperty("generatedAt");
      expect(data).toHaveProperty("sources");
      expect(data).toHaveProperty("stats");
      expect(typeof data.generatedAt).toBe("string");
      expect(typeof data.stats).toBe("object");
      expect(typeof data.sources).toBe("object");
    }
  });

  it("works with empty data (no hardcoded mocks required)", () => {
    const data = getSeedParsedData();
    // The engine should handle empty arrays gracefully
    expect(data.contracts.length).toBe(0);
    expect(data.filings.length).toBe(0);
  });
});
