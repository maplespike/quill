// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestYtGovernment, searchYtGovernment } from "../yt-government/index.js";

describe("yt-government", () => {
  it("should ingest Yukon government data", async () => {
    const result = await ingestYtGovernment();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for government datasets", async () => {
    const results = await searchYtGovernment("budget");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
