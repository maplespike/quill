#!/usr/bin/env node
// Reproducible social cards for Quill's editorial identity. Run from any cwd.
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const variants = [
  ['og-image', 'The public record.', 'An open possibility.', 'Canadian public data. Connected.'],
  ['og-image-pricing', 'A plan for your', 'next question.', 'Quill / Pricing'],
  ['og-image-docs', 'Build with', 'the public record.', 'Quill / Documentation'],
  ['og-image-agents', 'Your tools.', 'A wider perspective.', 'Quill / MCP + REST API'],
  ['og-image-fr', 'Les dossiers publics.', 'Un monde de possibles.', 'Les données publiques canadiennes. Reliées.'],
  ['og-image-pricing-fr', 'Un forfait pour', 'votre prochaine question.', 'Quill / Tarifs'],
  ['og-image-docs-fr', 'Créez avec', 'les dossiers publics.', 'Quill / Documentation'],
  ['og-image-agents-fr', 'Vos outils.', 'Une perspective élargie.', 'Quill / MCP + API REST'],
];
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const [name, line1, line2, label] of variants) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#f4f2ec"/>
    <path d="M70 118H1130M70 530H1130" stroke="#cfc8b8"/>
    <text x="70" y="82" font-family="Georgia,serif" font-size="48" fill="#161614">Quill<tspan fill="#a63029">.</tspan></text>
    <text x="1130" y="80" text-anchor="end" font-family="sans-serif" font-size="18" fill="#534f46">by MapleSpike</text>
    <text x="70" y="177" font-family="monospace" font-size="16" letter-spacing="2" fill="#534f46">${escape(label)}</text>
    <text x="66" y="302" font-family="Georgia,serif" font-size="76" letter-spacing="-2" fill="#161614">${escape(line1)}</text>
    <text x="66" y="398" font-family="Georgia,serif" font-size="76" letter-spacing="-2" font-style="italic" fill="#a63029">${escape(line2)}</text>
    <circle cx="79" cy="570" r="5" fill="#a63029"/>
    <text x="100" y="577" font-family="monospace" font-size="17" fill="#534f46">quill.maplespike.ca</text>
    <text x="1130" y="577" text-anchor="end" font-family="sans-serif" font-size="26" fill="#161614">↗</text>
  </svg>`;
  const destination = fileURLToPath(new URL(`../public/${name}.png`, import.meta.url));
  const info = await sharp(Buffer.from(svg)).png().toFile(destination);
  console.log(`${name}.png: ${info.width}×${info.height}, ${info.size} bytes`);
}
