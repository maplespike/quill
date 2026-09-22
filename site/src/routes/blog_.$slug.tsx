import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Shell } from "@/components/site/shell";
import { pageMeta } from "@/lib/page-meta";
import { findPost } from "@/lib/posts";

export const Route = createFileRoute("/blog_/$slug")({
  loader: ({ params }) => {
    const post = findPost(params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) => pageMeta(loaderData?.title ?? "Note", loaderData?.lede ?? ""),
  component: PostPage,
});

function PostPage() {
  const post = Route.useLoaderData();
  return (
    <Shell>
      <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">{post.date}</p>
        <h1 className="mt-3 font-display text-section text-ink">{post.title}</h1>
        <p className="mt-4 text-lg text-muted">{post.lede}</p>
        <div className="mt-8 space-y-4 text-ink-soft">
          {post.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <p className="mt-10 text-sm">
          <Link to="/blog" className="underline decoration-line-strong underline-offset-4">
            All notes
          </Link>
        </p>
      </article>
    </Shell>
  );
}
