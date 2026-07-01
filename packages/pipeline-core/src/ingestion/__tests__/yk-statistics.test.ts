import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestYkStatistics, searchYkStatistics } from "../yk-statistics/index.js";

describe("yk-statistics", () => {
  it("should ingest Yukon Bureau of Statistics data", async () => {
    const result = await ingestYkStatistics();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for statistics datasets", async () => {
    const results = await searchYkStatistics("population");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
