// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestWinnipegTransit, searchWinnipegTransit } from "../winnipeg-transit/index.js";

describe("winnipeg-transit", () => {
  it("should ingest Winnipeg transit data", async () => {
    const result = await ingestWinnipegTransit();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for transit datasets", async () => {
    const results = await searchWinnipegTransit("route");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
