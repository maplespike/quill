// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestEdmontonTransit, searchEdmontonTransit } from "../edmonton-transit/index.js";

describe("edmonton-transit", () => {
  it("should ingest Edmonton transit data", async () => {
    const result = await ingestEdmontonTransit();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for transit datasets", async () => {
    const results = await searchEdmontonTransit("bus");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
