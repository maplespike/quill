import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

test("gen:all stops when a mandatory generator fails", () => {
  const dir = mkdtempSync(join(tmpdir(), "quill-generation-"));
  try {
    mkdirSync(join(dir, "scripts"));
    writeFileSync(join(dir, "scripts/gen-icons.mjs"), "process.exit(23);\n");
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const result = spawnSync("bash", ["-c", pkg.scripts["gen:all"]], { cwd: dir, encoding: "utf8" });
    expect(result.status).toBe(23);
    expect(result.stderr).toBe("");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
