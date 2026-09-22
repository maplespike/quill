import { cn } from "@/lib/utils";

type MarkProps = {
  className?: string;
  nib?: "paper" | "ink";
};

export function Mark({ className, nib = "paper" }: MarkProps) {
  const nibFill = nib === "paper" ? "var(--color-paper)" : "var(--color-ink)";
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <path
        d="M9.5 23.2c4.1-8.2 7.1-12.6 10.2-15.4 1-.9 2.2-.2 1.7 1.1-1 2.8-3.2 6.2-6.1 9.6-.7.8-1.7 1.2-2.7 1.1l-3.1 3.6Z"
        fill={nibFill}
      />
      <path d="M18.2 8.6c1.8 2.4 3.6 6.1 4.8 9.4.3.8-.5 1.5-1.3 1.2-1.6-.6-3.3-2.2-4.7-4.6-.5-1 .1-2.1 1.2-6Z" fill={nibFill} opacity="0.72" />
    </svg>
  );
}
