// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestNuBureauStatistics, searchNuBureauStatistics } from "../nu-bureau-statistics/index.js";

describe("nu-bureau-statistics", () => {
  it("should ingest known data files", async () => {
    const result = await ingestNuBureauStatistics();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
    assert.ok(result.records >= 0);
  }, { timeout: 30000 });

  it("should search by category", async () => {
    const results = await searchNuBureauStatistics("demographics");
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
    assert.ok(results[0].url.startsWith("https://www.gov.nu.ca/"));
  });

  it("should search by keyword", async () => {
    const results = await searchNuBureauStatistics("population");
    assert.ok(Array.isArray(results));
    assert.ok(results.some(r => r.category === "population"));
  });

  it("should return empty for no matches", async () => {
    const results = await searchNuBureauStatistics("xyznonexistent");
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  });
});
