import type { PlanId } from "@/lib/plans";

const KEY = "quill.waitlist.v1";

export type WaitlistEntry = {
  email: string;
  name: string;
  role: string;
  plan: PlanId;
  createdAt: string;
};

function read(): WaitlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is WaitlistEntry =>
        !!row &&
        typeof row === "object" &&
        typeof (row as WaitlistEntry).email === "string" &&
        typeof (row as WaitlistEntry).plan === "string",
    );
  } catch {
    return [];
  }
}

export function saveWaitlistEntry(
  entry: WaitlistEntry,
): { ok: true } | { ok: false; reason: "duplicate" } {
  const all = read();
  const email = entry.email.trim().toLowerCase();
  if (all.some((row) => row.email.trim().toLowerCase() === email)) {
    return { ok: false, reason: "duplicate" };
  }
  all.push({ ...entry, email });
  window.localStorage.setItem(KEY, JSON.stringify(all));
  return { ok: true };
}
