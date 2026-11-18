// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestYtEnvironment, searchYtEnvironment } from "../yt-environment/index.js";

describe("yt-environment", () => {
  it("should ingest Yukon Environment data", async () => {
    const result = await ingestYtEnvironment();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for environment datasets", async () => {
    const results = await searchYtEnvironment("wildlife");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
