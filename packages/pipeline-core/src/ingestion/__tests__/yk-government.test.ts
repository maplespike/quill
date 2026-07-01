import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestYkGovernment, searchYkGovernment } from "../yk-government/index.js";

describe("yk-government", () => {
  it("should ingest Yukon government data", async () => {
    const result = await ingestYkGovernment();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for government datasets", async () => {
    const results = await searchYkGovernment("budget");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
