import Database from "better-sqlite3";

const DB_PATH = "maplespike.sqlite";

interface NodeRow {
  id: string;
  type: string;
  label: string;
  properties: string;
}

interface EdgeRow {
  id: string;
  source_node: string;
  target_node: string;
  type: string;
  weight: number;
  properties: string;
  source_ref: string;
}

export async function graphHandler(req: Request, ctx: any, params: Record<string, string>): Promise<Response> {
  try {
    const db = new Database(DB_PATH, { readonly: true });

    const nodeRows = db.prepare("SELECT * FROM graph_nodes LIMIT 5000").all() as NodeRow[];
    const edgeRows = db.prepare("SELECT * FROM graph_edges LIMIT 50000").all() as EdgeRow[];

    const nodes = nodeRows.map((r: NodeRow) => ({
      id: r.id,
      type: r.type,
      label: r.label,
      properties: JSON.parse(r.properties || "{}"),
    }));

    const edges = edgeRows.map((r: EdgeRow) => ({
      id: r.id,
      source_node: r.source_node,
      target_node: r.target_node,
      type: r.type,
      weight: r.weight,
      source_ref: r.source_ref,
    }));

    return new Response(JSON.stringify({
      success: true,
      data: { nodes, edges, nodeCount: nodes.length, edgeCount: edges.length },
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: { code: "ENGINE_ERROR", message: "Graph data not available: " + (err as Error).message },
    }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
}
