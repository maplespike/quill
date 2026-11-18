// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ingestIndigenousLandClaims,
  searchIndigenousLandClaims,
} from "../indigenous-land-claims/index.js";

describe("indigenous-land-claims", () => {
  it("should ingest Indigenous land claims data", async () => {
    const result = await ingestIndigenousLandClaims();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for land claims datasets", async () => {
    const results = await searchIndigenousLandClaims("comprehensive");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
