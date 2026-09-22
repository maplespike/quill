export const SIGNAL_TYPES = [
  {
    id: "in-camera",
    name: "In-camera",
    detail: "A committee meeting the source marks as closed.",
    moduleIds: ["hoc", "senate"],
  },
  {
    id: "revolving",
    name: "Revolving door",
    detail: "A Governor in Council appointment that follows a lobbying registration.",
    moduleIds: ["gic", "ocl"],
  },
  {
    id: "sole-source",
    name: "Sole-source",
    detail: "A CanadaBuys award the notice describes as non-competitive.",
    moduleIds: ["buys"],
  },
  {
    id: "overlap",
    name: "Lobbying overlap",
    detail: "The same organization in the lobbying registry and in a hearing.",
    moduleIds: ["ocl", "hoc", "senate"],
  },
  {
    id: "ethics",
    name: "Ethics file",
    detail: "An examination opened by the Ethics Commissioner.",
    moduleIds: ["ethics"],
  },
] as const;
