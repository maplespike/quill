#!/usr/bin/env node
// gen-icons.mjs — Generate apple-touch-icon.png from favicon.svg via sharp.
// Run: node scripts/gen-icons.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const svg = readFileSync(new URL("../public/favicon.svg", import.meta.url));
const out = fileURLToPath(new URL("../public/apple-touch-icon.png", import.meta.url));

const info = await sharp(svg).resize(180, 180).png().toFile(out);
console.log("icons:", JSON.stringify(info));
