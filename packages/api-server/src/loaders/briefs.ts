import Database from "better-sqlite3";

const DB_PATH = "maplespike.sqlite";

interface BriefRow {
  id: string;
  title: string;
  summary: string;
  sections: string;
  entity_ids: string;
  confidence: number;
  generated_at: string;
  expires_at: string;
  created_at: string;
}

export async function briefsHandler(req: Request, ctx: any, params: Record<string, string>): Promise<Response> {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const rows = db.prepare(
      "SELECT * FROM briefs ORDER BY generated_at DESC LIMIT 50"
    ).all() as BriefRow[];

    const briefs = rows.map((r: BriefRow) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      sections: JSON.parse(r.sections || "[]"),
      entityIds: JSON.parse(r.entity_ids || "[]"),
      confidence: r.confidence,
      generatedAt: r.generated_at,
      expiresAt: r.expires_at || null,
    }));

    return new Response(JSON.stringify({ success: true, data: { briefs } }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: "ENGINE_ERROR", message: "Briefs not available: " + (err as Error).message },
    }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
}
