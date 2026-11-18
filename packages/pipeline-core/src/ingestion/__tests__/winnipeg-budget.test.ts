// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ingestWinnipegBudget, searchWinnipegBudget } from "../winnipeg-budget/index.js";

describe("winnipeg-budget", () => {
  it("should ingest Winnipeg budget data", async () => {
    const result = await ingestWinnipegBudget();
    assert.ok(typeof result.success === "boolean");
    assert.ok(typeof result.records === "number");
  }, { timeout: 15000 });

  it("should search for budget datasets", async () => {
    const results = await searchWinnipegBudget("expenditure");
    assert.ok(Array.isArray(results));
  }, { timeout: 15000 });
});
