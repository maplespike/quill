#!/usr/bin/env node
// gen-og-image.mjs — Generate OG image PNGs from their SVG sources via sharp.
// Social platforms (Facebook, Twitter, LinkedIn, Discord) require raster
// images for Open Graph previews; SVG is not supported.
// Run: node scripts/gen-og-image.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Each entry maps a public/ SVG source to its rasterized PNG output.
// The base image is the default share card; the rest are per-page variants
// wired through BaseLayout's `ogImage` prop.
const variants = [
  { src: "og-image.svg", out: "og-image.png" },
  { src: "og-image-pricing.svg", out: "og-image-pricing.png" },
  { src: "og-image-docs.svg", out: "og-image-docs.png" },
  { src: "og-image-agents.svg", out: "og-image-agents.png" },
  // French mirrors (BaseLayout swaps to the -fr.png when lang === 'fr')
  { src: "og-image-fr.svg", out: "og-image-fr.png" },
  { src: "og-image-pricing-fr.svg", out: "og-image-pricing-fr.png" },
  { src: "og-image-docs-fr.svg", out: "og-image-docs-fr.png" },
  { src: "og-image-agents-fr.svg", out: "og-image-agents-fr.png" },
];

for (const { src, out } of variants) {
  const svg = readFileSync(new URL(`../public/${src}`, import.meta.url));
  const dest = fileURLToPath(new URL(`../public/${out}`, import.meta.url));
  const info = await sharp(svg).resize(1200, 630).png().toFile(dest);
  console.log(`${out}:`, `${info.width}x${info.height}`, `${info.size} bytes`);
}
