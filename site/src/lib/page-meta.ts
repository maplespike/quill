export function pageMeta(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — Quill` },
      { name: "description", content: description },
    ],
  };
}
