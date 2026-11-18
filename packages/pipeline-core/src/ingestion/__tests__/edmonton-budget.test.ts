// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestEdmontonBudget, searchEdmontonBudget } from "../edmonton-budget/index.js";

describe("edmonton-budget", () => {
  it("should ingest Edmonton budget data", async () => {
    const result = await ingestEdmontonBudget();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for budget datasets", async () => {
    const results = await searchEdmontonBudget("expenditure");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
