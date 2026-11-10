// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Alias Management
 *
 * Manages canonical names and their aliases for Canadian government entities.
 * Pre-seeded with well-known abbreviations and name changes for federal
 * departments, agencies, and common organizational variants.
 */

import type Database from "better-sqlite3";
import type { AliasEntry } from "./types";

/** Well-known Canadian government department/agency aliases */
const PRESEEDED_ORG_ALIASES: Array<[canonical: string, alias: string]> = [
  // National Defence
  ["Department of National Defence", "DND"],
  ["Department of National Defence", "National Defence"],
  ["Department of National Defence", "DND/CAF"],
  ["Department of National Defence", "Ministry of National Defence"],
  ["Department of National Defence", "Département de la Défense nationale"],
  ["Department of National Defence", "Defence Nationale"],

  // Global Affairs Canada
  ["Global Affairs Canada", "GAC"],
  ["Global Affairs Canada", "Foreign Affairs"],
  ["Global Affairs Canada", "Affaires étrangères"],
  ["Global Affairs Canada", "Department of Foreign Affairs"],
  [
    "Global Affairs Canada",
    "Department of Foreign Affairs, Trade and Development",
  ],
  ["Global Affairs Canada", "Affaires mondiales Canada"],
  ["Global Affairs Canada", "DFATD"],

  // Innovation, Science and Economic Development
  ["Innovation, Science and Economic Development Canada", "ISED"],
  ["Innovation, Science and Economic Development Canada", "Industry Canada"],
  ["Innovation, Science and Economic Development Canada", "Innovation Canada"],

  // Public Services and Procurement
  ["Public Services and Procurement Canada", "PSPC"],
  ["Public Services and Procurement Canada", "Public Works"],
  [
    "Public Services and Procurement Canada",
    "Public Works and Government Services Canada",
  ],
  ["Public Services and Procurement Canada", "PWGSC"],
  ["Public Services and Procurement Canada", "Travaux publics"],

  // Treasury Board
  ["Treasury Board of Canada Secretariat", "TBS"],
  ["Treasury Board of Canada Secretariat", "Treasury Board"],
  ["Treasury Board of Canada Secretariat", "Secrétariat du Conseil du Trésor"],

  // Employment and Social Development
  ["Employment and Social Development Canada", "ESDC"],
  [
    "Employment and Social Development Canada",
    "Human Resources and Skills Development Canada",
  ],
  ["Employment and Social Development Canada", "HRSDC"],

  // Health
  ["Health Canada", "HC"],
  ["Health Canada", "Santé Canada"],

  // Environment
  ["Environment and Climate Change Canada", "ECCC"],
  ["Environment and Climate Change Canada", "Environment Canada"],

  // Indigenous Services
  ["Indigenous Services Canada", "ISC"],

  // Crown-Indigenous Relations
  ["Crown-Indigenous Relations and Northern Affairs Canada", "CIRNAC"],
  [
    "Crown-Indigenous Relations and Northern Affairs Canada",
    "Indigenous and Northern Affairs Canada",
  ],
  ["Crown-Indigenous Relations and Northern Affairs Canada", "INAC"],

  // Fisheries and Oceans
  ["Fisheries and Oceans Canada", "DFO"],
  ["Fisheries and Oceans Canada", "Pêches et Océans Canada"],

  // Transport
  ["Transport Canada", "TC"],
  ["Transport Canada", "Transports Canada"],

  // Canada Border Services
  ["Canada Border Services Agency", "CBSA"],
  [
    "Canada Border Services Agency",
    "Agence des services frontaliers du Canada",
  ],

  // Canadian International Development Agency (absorbed into GAC)
  ["Global Affairs Canada", "Canadian International Development Agency"],
  ["Global Affairs Canada", "CIDA"],

  // National Research Council
  ["National Research Council Canada", "NRC"],
  ["National Research Council Canada", "Conseil national de recherches Canada"],

  // Public Safety
  ["Public Safety Canada", "PS"],
  ["Public Safety Canada", "Sécurité publique Canada"],

  // Veterans Affairs
  ["Veterans Affairs Canada", "VAC"],
  ["Veterans Affairs Canada", "Anciens Combattants Canada"],

  // Agriculture
  ["Agriculture and Agri-Food Canada", "AAFC"],
  ["Agriculture and Agri-Food Canada", "Agriculture Canada"],

  // Natural Resources
  ["Natural Resources Canada", "NRCan"],
  ["Natural Resources Canada", "Ressources naturelles Canada"],

  // Defence Construction Canada
  ["Defence Construction Canada", "DCC"],

  // Communications Security Establishment
  ["Communications Security Establishment", "CSE"],
  [
    "Communications Security Establishment",
    "Centre de la sécurité des télécommunications",
  ],

  // Lockheed Martin variants
  ["Lockheed Martin Corporation", "Lockheed Martin"],
  ["Lockheed Martin Corporation", "Lockheed Martin Canada"],
  ["Lockheed Martin Corporation", "Lockheed Martin Corp"],
  ["Lockheed Martin Corporation", "LMT"],
  ["Lockheed Martin Corporation", "Lockheed"],

  // General Dynamics variants
  ["General Dynamics", "General Dynamics Corporation"],
  ["General Dynamics", "General Dynamics Canada"],
  ["General Dynamics", "General Dynamics Land Systems"],
  ["General Dynamics", "General Dynamics Land Systems-Canada"],
  ["General Dynamics", "GDLS"],
  ["General Dynamics", "GD"],
];

/** Pre-seeded person aliases are rare — mostly common diminutives */
const PRESEEDED_PERSON_ALIASES: Array<[canonical: string, alias: string]> = [
  // Common Canadian political name variants (not exhaustive)
  ["Justin Trudeau", "Justin P.J. Trudeau"],
  ["Stephen Harper", "Stephen J. Harper"],
];

export class AliasManager {
  private db: Database.Database;
  private initDone = false;

  constructor(db: Database.Database) {
    this.db = db;
    this.init();
  }

  private init(): void {
    this.db.exec(`
			CREATE TABLE IF NOT EXISTS aliases (
				canonical TEXT NOT NULL,
				alias TEXT NOT NULL,
				type TEXT NOT NULL CHECK(type IN ('person', 'org')),
				source TEXT NOT NULL DEFAULT 'resolution',
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				PRIMARY KEY (canonical, alias, type)
			);
			CREATE INDEX IF NOT EXISTS idx_aliases_alias ON aliases(alias);
			CREATE INDEX IF NOT EXISTS idx_aliases_canonical ON aliases(canonical);
		`);

    if (!this.initDone) {
      this.seed();
      this.initDone = true;
    }
  }

  /** Pre-seed well-known aliases */
  private seed(): void {
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO aliases (canonical, alias, type, source) VALUES (?, ?, ?, 'pre-seeded')`,
    );

    const batch = this.db.transaction(() => {
      for (const [canonical, alias] of PRESEEDED_ORG_ALIASES) {
        insert.run(canonical, alias, "org");
      }
      for (const [canonical, alias] of PRESEEDED_PERSON_ALIASES) {
        insert.run(canonical, alias, "person");
      }
    });
    batch();
  }

  /**
   * Resolve a name to its canonical form.
   * If the name is itself canonical, it's returned as-is.
   * If unknown, returns the input name.
   */
  getCanonicalName(name: string, type: "person" | "org"): string {
    const row = this.db
      .prepare(`SELECT canonical FROM aliases WHERE alias = ? AND type = ?`)
      .get(name, type) as { canonical: string } | undefined;

    if (row) return row.canonical;

    // Check if the name is already a canonical form
    const asCanonical = this.db
      .prepare(`SELECT canonical FROM aliases WHERE canonical = ? AND type = ?`)
      .get(name, type) as { canonical: string } | undefined;

    return asCanonical ? asCanonical.canonical : name;
  }

  /**
   * Register a new alias for a canonical name.
   */
  addAlias(
    canonical: string,
    alias: string,
    type: "person" | "org",
    source = "resolution",
  ): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO aliases (canonical, alias, type, source) VALUES (?, ?, ?, ?)`,
      )
      .run(canonical, alias, type, source);
  }

  /**
   * Retrieve all known aliases for a canonical name.
   */
  getAliases(canonical: string, type?: "person" | "org"): string[] {
    if (type) {
      const rows = this.db
        .prepare(`SELECT alias FROM aliases WHERE canonical = ? AND type = ?`)
        .all(canonical, type) as Array<{ alias: string }>;
      return rows.map((r) => r.alias);
    }
    const rows = this.db
      .prepare(`SELECT alias FROM aliases WHERE canonical = ?`)
      .all(canonical) as Array<{ alias: string }>;
    return rows.map((r) => r.alias);
  }

  /**
   * Get all alias entries matching a type.
   */
  getAllEntries(type?: "person" | "org"): AliasEntry[] {
    if (type) {
      return this.db
        .prepare(
          `SELECT canonical, alias, type, source, created_at as createdAt FROM aliases WHERE type = ?`,
        )
        .all(type) as AliasEntry[];
    }
    return this.db
      .prepare(
        `SELECT canonical, alias, type, source, created_at as createdAt FROM aliases`,
      )
      .all() as AliasEntry[];
  }

  /**
   * Check if a name is known (either as canonical or alias).
   */
  isKnown(name: string, type: "person" | "org"): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM aliases WHERE (canonical = ? OR alias = ?) AND type = ? LIMIT 1`,
      )
      .get(name, name, type);
    return row !== undefined;
  }
}
