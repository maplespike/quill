import Database from "better-sqlite3";

const DB_PATH = "maplespike.sqlite";

export async function entitiesHandler(req: Request, ctx: any, params: Record<string, string>): Promise<Response> {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    const personRows = db.prepare("SELECT * FROM persons ORDER BY updated_at DESC LIMIT 5000").all() as any[];
    const orgRows = db.prepare("SELECT * FROM organizations ORDER BY updated_at DESC LIMIT 5000").all() as any[];

    const entities = [
      ...personRows.map((r: any) => ({
        id: r.id,
        canonicalName: JSON.parse(r.names || "[]")[0] || r.id,
        type: "person",
        confidence: 1.0,
        aliases: JSON.parse(r.names || "[]").slice(1).map((n: string) => ({ name: n, source: r.source })),
        metadata: { province: r.province, source: r.source },
      })),
      ...orgRows.map((r: any) => ({
        id: r.id,
        canonicalName: JSON.parse(r.names || "[]")[0] || r.id,
        type: r.type || "organization",
        confidence: 1.0,
        aliases: JSON.parse(r.names || "[]").slice(1).map((n: string) => ({ name: n, source: r.source })),
        metadata: { industry: r.industry, province: r.province, source: r.source },
      })),
    ];

    return new Response(JSON.stringify({
      success: true,
      data: { entities, links: [], totalEntities: entities.length },
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: "ENGINE_ERROR", message: "Entity data not available: " + (err as Error).message },
    }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
}
