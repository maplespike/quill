import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium tracking-tight transition-[background-color,color,transform,opacity] duration-150 ease-smooth-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-ink text-paper hover:bg-ink-soft focus-visible:ring-ink/40 focus-visible:ring-offset-paper",
        secondary:
          "border border-line-strong bg-transparent text-ink hover:bg-chip focus-visible:ring-ink/30 focus-visible:ring-offset-paper",
        inverse:
          "bg-paper text-ink hover:bg-paper-deep focus-visible:ring-on-ink/70 focus-visible:ring-offset-ink",
        ghost:
          "border border-on-ink-line bg-transparent text-on-ink hover:bg-ink-soft focus-visible:ring-on-ink/70 focus-visible:ring-offset-ink",
      },
      size: {
        md: "h-11",
        lg: "h-12 px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
