/**
 * Generates the PWA icons referenced by app/layout.tsx and
 * public/manifest.webmanifest. Run with: npm run icons
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.resolve('public/icons');

// Simple brand mark: teal rounded square, white document + pill.
const svg = (pad = 0) => {
  // Content is drawn inside a 100x100 box; `pad` shrinks it for maskable icons.
  const s = 100 - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${pad ? 0 : 20}" fill="#0F766E"/>
  <g transform="translate(${pad} ${pad})">
    <rect x="${s * 0.24}" y="${s * 0.16}" width="${s * 0.44}" height="${s * 0.6}" rx="${s * 0.05}" fill="#FFFFFF"/>
    <g stroke="#0F766E" stroke-width="${s * 0.035}" stroke-linecap="round">
      <line x1="${s * 0.31}" y1="${s * 0.32}" x2="${s * 0.61}" y2="${s * 0.32}"/>
      <line x1="${s * 0.31}" y1="${s * 0.44}" x2="${s * 0.61}" y2="${s * 0.44}"/>
      <line x1="${s * 0.31}" y1="${s * 0.56}" x2="${s * 0.51}" y2="${s * 0.56}"/>
    </g>
    <g transform="rotate(-35 ${s * 0.68} ${s * 0.62})">
      <rect x="${s * 0.56}" y="${s * 0.53}" width="${s * 0.24}" height="${s * 0.14}" rx="${s * 0.07}" fill="#FFFFFF" stroke="#134E4A" stroke-width="${s * 0.025}"/>
      <line x1="${s * 0.68}" y1="${s * 0.53}" x2="${s * 0.68}" y2="${s * 0.67}" stroke="#134E4A" stroke-width="${s * 0.025}"/>
    </g>
  </g>
</svg>`;
};

const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 20 }, // safe-zone padding
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
];

await mkdir(OUT_DIR, { recursive: true });
for (const { file, size, pad } of targets) {
  const png = await sharp(Buffer.from(svg(pad))).resize(size, size).png().toBuffer();
  await writeFile(path.join(OUT_DIR, file), png);
  console.log(`✓ ${file} (${size}x${size})`);
}
