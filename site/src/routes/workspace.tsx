import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { newId, newSecret } from "@/lib/desk";
import { pageMeta } from "@/lib/page-meta";
import { useDesk } from "@/lib/use-desk";

const field =
  "mt-2 w-full rounded-control border border-line bg-surface px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/30";

export const Route = createFileRoute("/workspace")({
  head: () => pageMeta("Workspace", "Notes and preview keys kept in this browser."),
  component: WorkspacePage,
});

function WorkspacePage() {
  const { desk, ready, update } = useDesk();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update({
      ...desk,
      notes: [{ id: newId(), title: title.trim(), body: body.trim(), created: new Date().toISOString() }, ...desk.notes],
    });
    setTitle("");
    setBody("");
  }

  function addKey() {
    const secret = newSecret();
    update({
      ...desk,
      keys: [{ id: newId(), label: "Preview", secret, created: new Date().toISOString() }, ...desk.keys],
    });
    setRevealed(secret);
  }

  function revoke(id: string) {
    update({ ...desk, keys: desk.keys.filter((key) => key.id !== id) });
  }

  return (
    <Shell>
      <PageHeader
        kicker="Workspace"
        title="A desk for the note and the key."
        lede="Preview keys are generated here and never sent. They will not authenticate against api.maplespike.ca."
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl tracking-tight">Notes</h2>
          <form onSubmit={addNote} className="mt-4 grid gap-3">
            <div>
              <label htmlFor="note-title" className="text-sm font-medium">
                Title
              </label>
              <input id="note-title" required value={title} onChange={(event) => setTitle(event.target.value)} className={`${field} h-11`} />
            </div>
            <div>
              <label htmlFor="note-body" className="text-sm font-medium">
                Note
              </label>
              <textarea id="note-body" required rows={4} value={body} onChange={(event) => setBody(event.target.value)} className={`${field} p-3`} />
            </div>
            <Button type="submit" className="w-fit">
              Save note
            </Button>
          </form>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {ready && desk.notes.length === 0 ? (
              <li className="py-4 text-muted">No notes yet.</li>
            ) : (
              desk.notes.map((note) => (
                <li key={note.id} className="py-4">
                  <p className="text-ink">{note.title}</p>
                  <p className="mt-1 text-sm text-muted">{note.body}</p>
                </li>
              ))
            )}
          </ul>
        </section>
        <section>
          <h2 className="font-display text-2xl tracking-tight">Preview keys</h2>
          <Button type="button" className="mt-4" onClick={addKey}>
            Generate a preview key
          </Button>
          {revealed ? (
            <p className="mt-4 break-all rounded-control border border-line bg-surface p-4 font-mono text-xs text-ink" role="status">
              Copy it now. {revealed}
            </p>
          ) : null}
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {ready && desk.keys.length === 0 ? (
              <li className="py-4 text-muted">No preview keys.</li>
            ) : (
              desk.keys.map((key) => (
                <li key={key.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-mono text-xs text-ink">{key.secret.slice(0, 18)}…</p>
                    <p className="text-sm text-muted">{key.created.slice(0, 10)}</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => revoke(key.id)}>
                    Revoke
                  </Button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </Shell>
  );
}
