import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestYkEnvironment, searchYkEnvironment } from "../yk-environment/index.js";

describe("yk-environment", () => {
  it("should ingest Yukon Environment data", async () => {
    const result = await ingestYkEnvironment();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for environment datasets", async () => {
    const results = await searchYkEnvironment("wildlife");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
