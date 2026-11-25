/**
 * Default /signal and /explorer views, and the committed pipeline asset,
 * must not present invented records as real public data.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { emptyCrossReference } from "../scripts/generate-pipeline-data.mjs";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const INVENTED_SIGNAL_TEXT = [
  "SIG-001",
  "Thirteen new lobbying registrations",
  "Treize nouvelles inscriptions de lobbying",
  "Office of the Commissioner of Lobbying",
  "Commissariat au lobbying",
  "CRTC opens consultation on AI-generated content",
  "House of Commons — ETHI Committee",
  "Chambre des communes — Comité ETHI",
  "Phoenix pay system remediation",
  "Eight insider trades filed by telecom executives",
  "SEDI / CSA",
  "SEDI / ACVM",
  "Proposed Clean Electricity Regulations",
  "34th fiscal sustainability report",
  "Parliamentary Budget Officer",
  "Directeur parlementaire du budget",
  "500K annual target",
];

const INVENTED_EXPLORER_TEXT = [
  "Meeting No. 142",
  "Réunion n° 142",
  "12,847",
  "12 847",
  "/explorer/result/",
  "Clean Fuel Standard Amendments",
  "Rogers–Shaw",
  "2026 FCA 89",
  "showcase data",
  "données de démonstration",
  "showcaseHtml",
  "96%",
];

const INVENTED_BROOKFIELD = [
  "Brookfield Asset Management",
  "Witness testimony referenced Brookfield",
  "ourcommons.ca/DocumentViewer/en/44-1/FINA/meeting-120",
  "ourcommons.ca/DocumentViewer/en/44-1/INDU/meeting-95",
  "ourcommons.ca/DocumentViewer/en/44-1/ENVI/meeting-80",
  "C$2,850,000",
];

describe("default public views omit invented records", () => {
  test("signal page default markup is an empty state", () => {
    const source = read("src/pages/signal.astro");
    expect(source).toContain('data-signal-state="empty"');
    expect(source).toContain("No signals to show");
    expect(source).toContain("Aucun signal à afficher");
    for (const phrase of INVENTED_SIGNAL_TEXT) {
      expect(source, phrase).not.toContain(phrase);
    }
  });

  test("explorer default markup is an empty result set", () => {
    const source = read("src/pages/explorer.astro");
    expect(source).toContain('data-explorer-state="empty"');
    expect(source).toContain("No results yet. Search to load records from the live API.");
    expect(source).toMatch(/id="results-total"[^>]*>0</);
    expect(source).toMatch(/id="results-shown"[^>]*>0</);
    for (const phrase of INVENTED_EXPLORER_TEXT) {
      expect(source, phrase).not.toContain(phrase);
    }
  });

  test("committed cross-reference sample has no testimony and no real URLs", () => {
    const data = JSON.parse(read("assets/pipeline-data.json"));
    const block = data.crossReference;
    expect(block.matches).toEqual([]);
    expect(block.timeline).toEqual([]);
    expect(block.totalMatches).toBe(0);
    expect(block.entity).toBe("");
    const serialized = JSON.stringify(block);
    expect(serialized).not.toMatch(/https?:\/\//);
    for (const phrase of INVENTED_BROOKFIELD) {
      expect(serialized, phrase).not.toContain(phrase);
    }
  });

  test("generator emits an empty cross-reference block", () => {
    const source = read("scripts/generate-pipeline-data.mjs");
    for (const phrase of INVENTED_BROOKFIELD) {
      expect(source, phrase).not.toContain(phrase);
    }
    const sample = emptyCrossReference();
    expect(sample.entity).toBe("");
    expect(sample.matches).toEqual([]);
    expect(sample.timeline).toEqual([]);
    expect(sample.totalMatches).toBe(0);
    expect(JSON.stringify(sample)).not.toMatch(/https?:\/\//);
  });
});
