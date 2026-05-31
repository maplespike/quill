import { useState, useEffect } from "react";

const STORAGE_KEY = "maplespike-journalism-mode";

export default function JournalismToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setEnabled(true);
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, String(next));
    window.dispatchEvent(new CustomEvent("journalism-mode", { detail: { enabled: next } }));
  }

  return (
    <button
      onClick={toggle}
      title={`Journalism mode: ${enabled ? "ON" : "OFF"}`}
      style={{
        padding: "4px 10px", fontSize: "0.72rem", fontWeight: 600,
        fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase",
        borderRadius: 4, border: `1px solid ${enabled ? "#e84545" : "var(--color-border)"}`,
        background: enabled ? "#e84545" : "transparent",
        color: enabled ? "#fff" : "var(--color-text-secondary)",
        cursor: "pointer", letterSpacing: "0.05em", transition: "all 100ms ease-out",
      }}
    >
      {enabled ? "Journalism ON" : "Journalism OFF"}
    </button>
  );
}
