// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestNtOpenGovernment, searchNtOpenGovernment } from "../nt-open-government/index.js";

describe("nt-open-government", () => {
  it("should ingest NWT open government page", async () => {
    const result = await ingestNtOpenGovernment();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for data products", async () => {
    const results = await searchNtOpenGovernment("data");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
