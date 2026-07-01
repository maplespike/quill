import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestYkGeological, searchYkGeological } from "../yk-geological/index.js";

describe("yk-geological", () => {
  it("should ingest Yukon Geological Survey data", async () => {
    const result = await ingestYkGeological();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for geological datasets", async () => {
    const results = await searchYkGeological("minerals");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
