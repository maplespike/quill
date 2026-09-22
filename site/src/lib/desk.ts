export type PreviewKey = {
  id: string;
  label: string;
  secret: string;
  created: string;
};

export type Watch = {
  id: string;
  moduleId: string;
  created: string;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  created: string;
};

export type Seat = {
  name: string;
  email: string;
  org: string;
  tier: "open" | "desk" | "sovereign";
};

export type Extraction = {
  url: string;
  cadence: "daily" | "weekly";
  jurisdiction: string;
};

export type DeskState = {
  keys: PreviewKey[];
  watches: Watch[];
  notes: Note[];
  seat: Seat | null;
  contact: { name: string; email: string; message: string } | null;
  extraction: Extraction | null;
};

const STORAGE_KEY = "quill.desk";

export const emptyDesk: DeskState = {
  keys: [],
  watches: [],
  notes: [],
  seat: null,
  contact: null,
  extraction: null,
};

export function loadDesk(): DeskState {
  if (typeof window === "undefined") return emptyDesk;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDesk;
    const parsed = JSON.parse(raw) as Partial<DeskState>;
    return { ...emptyDesk, ...parsed };
  } catch {
    return emptyDesk;
  }
}

export function saveDesk(next: DeskState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function newId() {
  return crypto.randomUUID();
}

export function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const body = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `quill_preview_${body}`;
}
