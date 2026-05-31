import { useState, useEffect } from "react";

interface Annotation { id: string; entityType: string; entityId: string; annotationType: string; content: string; createdAt: string }

export default function AnnotationModal({ entityType, entityId, onClose }: { entityType: string; entityId: string; onClose: () => void }) {
  const [type, setType] = useState("note");
  const [content, setContent] = useState("");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    fetch(`/api/annotations?entity_type=${entityType}&entity_id=${entityId}`)
      .then(r => r.json()).then(d => { if (d.success) setAnnotations(d.data.annotations || []); }).catch(() => {});
  }, [entityType, entityId]);

  async function handleSubmit() {
    await fetch("/api/annotations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, annotation_type: type, content }),
    });
    setContent("");
    window.location.reload();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--color-surface-elevated)", borderRadius: 12, padding: 24, maxWidth: 500, width: "90%", maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Annotations</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
        </div>

        {annotations.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {annotations.map(a => (
              <div key={a.id} style={{ padding: "8px 12px", marginBottom: 8, background: "var(--color-surface)", borderRadius: 8, borderLeft: "3px solid var(--color-primary)" }}>
                <div style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "var(--color-primary)", fontWeight: 600, marginBottom: 4 }}>{a.annotationType}</div>
                <div style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>{a.content}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginTop: 4 }}>{new Date(a.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        <select value={type} onChange={e => setType(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", marginBottom: 8, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, color: "var(--color-text)", fontSize: "0.85rem" }}>
          <option value="note">Note</option>
          <option value="context">Context</option>
          <option value="flag">Flag</option>
          <option value="override">Override</option>
        </select>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your annotation..."
          style={{ width: "100%", minHeight: 100, padding: 12, marginBottom: 12, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, color: "var(--color-text)", fontSize: "0.85rem", resize: "vertical", fontFamily: "inherit" }} />
        <button onClick={handleSubmit} disabled={!content.trim()}
          style={{ padding: "8px 20px", background: "var(--color-primary)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", opacity: content.trim() ? 1 : 0.5 }}>
          Save Annotation
        </button>
      </div>
    </div>
  );
}
