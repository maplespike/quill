export type Post = {
  slug: string;
  title: string;
  date: string;
  lede: string;
  paragraphs: string[];
};

export const POSTS: Post[] = [
  {
    slug: "ink-and-paper",
    title: "The portal drops the aurora",
    date: "September 2026",
    lede: "The public site is now the ink-and-paper system. The dark guide is retired.",
    paragraphs: [
      "The previous portal used Inter, a maple-red primary, cyan focus rings, and an aurora wash on the hero. That guide is no longer the one we build to.",
      "Titles are Newsreader. Body text is Source Sans 3. Hashes, labels, and endpoints are IBM Plex Mono. Ink does the emphasis. Paper is the page.",
      "The product did not change. 207 modules, 184 tools, and a hash you can recompute are the same promise. The chrome finally matches a record, not a launch trailer.",
    ],
  },
  {
    slug: "repository-rename",
    title: "The tree is quill. The brand is MapleSpike.",
    date: "July 2026",
    lede: "The working tree renamed from maplespike to quill. The remote and the npm scope stayed.",
    paragraphs: [
      "Image names and chart names are quill-*. The GitHub remote is still reverb256/quill after the rename, and the published scope is still @maplespike.",
      "maplespike.ca remains the organization domain. quill.maplespike.ca is the portal. api.maplespike.ca is the gateway. mcp.maplespike.ca is the remote server.",
      "If a doc still says the product was called MapleSpike in a sentence about the company, that sentence is right. If it says the repository is maplespike, it is out of date.",
    ],
  },
  {
    slug: "tools-on-rows",
    title: "The tools read the database",
    date: "July 2026",
    lede: "184 MCP tools return rows, not a demo payload. The engine joins the registries.",
    paragraphs: [
      "resolve_entity, linked_entities, and get_entity_profile share one id across lobbying, committees, GIC appointments, contracts, and elections.",
      "get_citation and verify_claim stay free. A stored hash is only useful if someone outside Quill can recompute it.",
      "Stripe checkout is live for Pro+. The public site's tiers are Open, Desk, and Sovereign. Open is 1,000 calls a month.",
    ],
  },
];

export function findPost(slug: string) {
  return POSTS.find((post) => post.slug === slug);
}
