// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestYtStatistics, searchYtStatistics } from "../yt-statistics/index.js";

describe("yt-statistics", () => {
  it("should ingest Yukon Bureau of Statistics data", async () => {
    const result = await ingestYtStatistics();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for statistics datasets", async () => {
    const results = await searchYtStatistics("population");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
