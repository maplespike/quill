// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestYtGeological, searchYtGeological } from "../yt-geological/index.js";

describe("yt-geological", () => {
  it("should ingest Yukon Geological Survey data", async () => {
    const result = await ingestYtGeological();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for geological datasets", async () => {
    const results = await searchYtGeological("minerals");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
