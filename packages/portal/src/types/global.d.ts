import "react";

/**
 * The portal's .astro templates pass the HTML `class` attribute to shadcn
 * components (React). React types only know `className`, which produced ~230
 * ts(2322) errors AND silently dropped the prop at runtime. The ui components
 * in src/components/ui/* merge `class` into `className`; this augmentation
 * makes the prop valid on every React HTML-attributes-based component.
 */
declare module "react" {
  interface HTMLAttributes<T> {
    /** HTML `class` alias — .astro templates pass `class`; ui components merge it into `className`. */
    class?: string;
  }
}

declare global {
  interface Window {
    /** Injected by BaseLayout.astro for client-side locale checks. */
    __LANG?: string;
  }
}

export {};
