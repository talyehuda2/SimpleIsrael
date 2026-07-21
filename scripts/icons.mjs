// מייצר את אייקוני ה-PWA מתוך SVG (מוטיב ציר-זמן: פסים בזהב על רקע נייבי).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..';

// pad = שוליים בטוחים (למסכות של אנדרואיד), rounded = פינות מעוגלות
const icon = ({ pad = 0, rounded = 0 }) => {
  const S = 512, i = pad, w = S - pad * 2;
  const bars = [
    { y: 0.30, x: 0.16, len: 0.62 },
    { y: 0.46, x: 0.30, len: 0.54 },
    { y: 0.62, x: 0.10, len: 0.46 },
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="#163a57"${rounded ? ` rx="${rounded}"` : ''}/>
  <g>
    ${bars.map(b => `<rect x="${i + w * b.x}" y="${i + w * b.y - w * 0.045}" width="${w * b.len}" height="${w * 0.09}" rx="${w * 0.045}" fill="#d9b755"/>`).join('\n    ')}
    <line x1="${i + w * 0.5}" y1="${i + w * 0.16}" x2="${i + w * 0.5}" y2="${i + w * 0.80}" stroke="#fbf5e7" stroke-width="${w * 0.022}" stroke-linecap="round" opacity="0.9"/>
    <circle cx="${i + w * 0.5}" cy="${i + w * 0.46}" r="${w * 0.062}" fill="#fbf5e7"/>
  </g>
</svg>`;
};

const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

mkdirSync(join(ROOT, 'public', 'icons'), { recursive: true });
const plain = icon({ pad: 0, rounded: 96 });
const maskable = icon({ pad: 64, rounded: 0 }); // 12.5% safe zone מכל צד

for (const s of [192, 512]) writeFileSync(join(ROOT, 'public', 'icons', `icon-${s}.png`), render(plain, s));
writeFileSync(join(ROOT, 'public', 'icons', 'maskable-512.png'), render(maskable, 512));
writeFileSync(join(ROOT, 'public', 'icons', 'apple-touch-icon.png'), render(icon({ pad: 26, rounded: 0 }), 180));
console.log('icons written');
