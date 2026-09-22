import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/page-header";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";
import { POSTS } from "@/lib/posts";

export const Route = createFileRoute("/blog")({
  head: () => pageMeta("Blog", "Notes on the Quill portal, the rename, and the tools."),
  component: BlogPage,
});

function BlogPage() {
  return (
    <Shell>
      <PageHeader
        kicker="Blog"
        title="Notes, not a content calendar."
        lede="Three entries. They match the changelog."
      />
      <ul className="mx-auto max-w-6xl divide-y divide-line border-y border-line px-5 sm:px-8">
        {POSTS.map((post) => (
          <li key={post.slug} className="py-8">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">{post.date}</p>
            <h2 className="mt-2 font-display text-2xl tracking-tight">
              <Link
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="text-ink hover:underline"
              >
                {post.title}
              </Link>
            </h2>
            <p className="mt-2 max-w-2xl text-muted">{post.lede}</p>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
