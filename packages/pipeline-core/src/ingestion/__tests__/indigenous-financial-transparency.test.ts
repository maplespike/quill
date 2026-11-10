// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ingestIndigenousFinancialTransparency,
  searchIndigenousFinancialTransparency,
} from "../indigenous-financial-transparency/index.js";

describe("indigenous-financial-transparency", () => {
  it("should ingest First Nations financial transparency data", async () => {
    const result = await ingestIndigenousFinancialTransparency();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for financial transparency datasets", async () => {
    const results = await searchIndigenousFinancialTransparency("salaries");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
