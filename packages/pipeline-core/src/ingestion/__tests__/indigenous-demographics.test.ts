// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ingestIndigenousDemographics,
  searchIndigenousDemographics,
} from "../indigenous-demographics/index.js";

describe("indigenous-demographics", () => {
  it("should ingest Indigenous demographics data", async () => {
    const result = await ingestIndigenousDemographics();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for Indigenous demographics datasets", async () => {
    const results = await searchIndigenousDemographics("census");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
