import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/site/shell";

export function NotFound() {
  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">404</p>
        <h1 className="mt-3 font-display text-section text-ink">That page is not in the record.</h1>
        <p className="mt-4 max-w-md text-muted">The path does not match a Quill page.</p>
        <Button asChild className="mt-8">
          <Link to="/">Back to Quill</Link>
        </Button>
      </div>
    </Shell>
  );
}
