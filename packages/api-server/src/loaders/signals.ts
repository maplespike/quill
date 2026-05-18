import Database from "better-sqlite3";

const DB_PATH = "maplespike.sqlite";

interface SignalRow {
  id: string;
  title: string;
  description: string;
  signal_type: string;
  confidence: number;
  nodes: string;
  edges: string;
  sources: string;
  created_at: string;
}

export async function signalsHandler(req: Request, ctx: any, params: Record<string, string>): Promise<Response> {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const rows = db.prepare(
      "SELECT * FROM intelligence_threads ORDER BY created_at DESC LIMIT 100"
    ).all() as SignalRow[];

    const signals = rows.map((r: SignalRow) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      signalType: r.signal_type,
      confidence: r.confidence,
      nodes: JSON.parse(r.nodes || "[]"),
      edges: JSON.parse(r.edges || "[]"),
      sources: JSON.parse(r.sources || "[]"),
      createdAt: r.created_at,
    }));

    return new Response(JSON.stringify({ success: true, data: signals }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: "ENGINE_ERROR", message: "Engine data not available: " + (err as Error).message },
    }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
}
