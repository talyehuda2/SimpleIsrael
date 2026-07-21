// מייצר דפי-נחיתה סטטיים (HTML מוכן לגוגל) לכל דמות/אירוע/ספר, וכן
// sitemap.xml, robots.txt ודף אינדקס. רץ אחרי `vite build`.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hebrewYearLetters, toSecular, formatRange } from '../src/utils/dates.js';
import { sourceSegments } from '../src/utils/sefaria.js';
import { writeCard } from './og.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const DATA = join(ROOT, 'src', 'data');
const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

const SITE = 'https://simpleisrael.co.il';
const leaders = read('leaders.json');
const judges = read('judges.json');
const kings = read('kings.json');
const prophets = read('prophets.json');
const books = read('books.json');
const world = read('world.json');
const events = read('events.json');
const periods = read('periods.json');

const KINDS = {
  leader: { label: 'מנהיג', schema: 'Person', group: 'אבות ומנהיגים' },
  judge: { label: 'שופט', schema: 'Person', group: 'שופטים' },
  united: { label: 'מלך הממלכה המאוחדת', schema: 'Person', group: 'מלכים' },
  judah: { label: 'מלך יהודה', schema: 'Person', group: 'מלכים' },
  israel: { label: 'מלך ישראל', schema: 'Person', group: 'מלכים' },
  prophet: { label: 'נביא', schema: 'Person', group: 'נביאים' },
  book: { label: 'ספר תנ״ך', schema: 'Book', group: 'ספרי תנ״ך' },
  world: { label: 'דמות עולמית', schema: 'Person', group: 'רקע עולמי' },
  event: { label: 'אירוע', schema: 'Event', group: 'אירועים' },
};

const items = [
  ...leaders.map((x) => ({ ...x, kind: 'leader' })),
  ...judges.map((x) => ({ ...x, kind: 'judge' })),
  ...kings.united.map((x) => ({ ...x, kind: 'united' })),
  ...kings.judah.map((x) => ({ ...x, kind: 'judah' })),
  ...kings.israel.map((x) => ({ ...x, kind: 'israel' })),
  ...prophets.map((x) => ({ ...x, kind: 'prophet' })),
  ...books.map((x) => ({ ...x, kind: 'book' })),
  ...world.map((x) => ({ ...x, kind: 'world' })),
  ...events.map((x) => ({ ...x, kind: 'event', start: x.year, end: x.year })),
];

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s = '') => esc(s).replace(/"/g, '&quot;');
const clean = (s = '') => String(s).replace(/\s+/g, ' ').trim();
const truncate = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trim() + '…');
const urlOf = (it) => `${SITE}/p/${it.kind}/${it.id}`;

// שכנים באותה קטגוריה (לקישורים פנימיים לזחילה)
const byKind = {};
for (const it of items) (byKind[it.kind] ||= []).push(it);
for (const k in byKind) byKind[k].sort((a, b) => a.start - b.start);

// חפיפה בזמן — אותה הגדרה כמו "בני-הזמן" באפליקציה
function overlaps(a, b) {
  if (a.start === a.end) return a.start >= b.start && a.start <= b.end;
  if (b.start === b.end) return b.start >= a.start && b.start <= a.end;
  return a.start < b.end && a.end > b.start;
}
const MAX_CONTEMP = 16;
const contemporariesOf = (it) =>
  items.filter((o) => !(o.kind === it.kind && o.id === it.id) && overlaps(it, o))
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_CONTEMP);

// התקופה שבה הפריט מתחיל
const sortedPeriods = [...periods].sort((a, b) => a.start - b.start);
const periodOf = (it) =>
  sortedPeriods.find((p) => it.start >= p.start && it.start < p.end)
  || sortedPeriods.find((p) => it.start >= p.start && it.start <= p.end)
  || null;
const periodUrl = (p) => `${SITE}/p/period/${p.id}`;
const itemsInPeriod = (p) =>
  items.filter((it) => overlaps(it, p)).sort((a, b) => a.start - b.start);

const STYLE = `
:root{--bg:#efe4c8;--panel:#fbf5e7;--ink:#33281a;--muted:#7c6a4f;--navy:#163a57;--gold:#b28a2b;--line:#dcc9a3}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Frank Ruhl Libre','Heebo',Georgia,serif;line-height:1.7}
.wrap{max-width:720px;margin:0 auto;padding:20px 18px 48px}
header a{color:var(--navy);text-decoration:none;font-weight:700;font-size:15px}
.chip{display:inline-block;font-size:12px;font-weight:700;color:var(--gold);letter-spacing:.3px;margin:22px 0 4px}
h1{margin:0 0 6px;font-size:32px;color:var(--navy);font-weight:900}
.dates{color:var(--muted);font-size:15px;margin-bottom:16px}
.row{margin:6px 0;font-size:15px}
.row b{color:var(--navy)}
.desc{font-size:17px;line-height:1.85;margin:16px 0}
.src{font-size:14px;color:var(--muted);border-top:1px solid var(--line);padding-top:12px;margin-top:20px}
.src a{color:var(--gold);font-weight:700;text-decoration:none;border-bottom:1px dotted var(--gold)}
.cta{display:inline-block;margin:22px 0 8px;background:var(--navy);color:#fff;text-decoration:none;border-radius:22px;padding:12px 22px;font-size:16px;font-weight:700}
nav.rel{display:flex;justify-content:space-between;gap:10px;margin-top:26px;border-top:1px solid var(--line);padding-top:16px;font-size:14px}
nav.rel a{color:var(--navy);text-decoration:none;font-weight:600;max-width:46%}
footer{margin-top:34px;font-size:13px;color:var(--muted)}
footer a{color:var(--gold)}
.idx h2{color:var(--navy);font-size:20px;margin:26px 0 8px;border-bottom:2px solid var(--gold);padding-bottom:4px}
.idx ul{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:6px 14px}
.idx a{color:var(--navy);text-decoration:none;font-size:15px}
.idx a:hover{color:var(--gold)}
.dim{color:var(--muted);font-size:13px}
.related{margin-top:30px;border-top:1px solid var(--line);padding-top:16px}
.related h2{margin:0 0 4px;font-size:20px;color:var(--navy)}
.related-sub{margin:0 0 12px;font-size:14px;color:var(--muted)}
.chips{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px}
.chips a{display:flex;flex-direction:column;gap:1px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px 11px;text-decoration:none}
.chips a:hover{border-color:var(--gold)}
.cl-name{color:var(--navy);font-size:14.5px;font-weight:700}
.cl-kind{color:var(--muted);font-size:11px}
`;

function shell({ title, description, canonical, jsonld, body, ogImage }) {
  const img = ogImage || `${SITE}/og-image.jpg`;
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escAttr(title)}</title>
<meta name="description" content="${escAttr(description)}"/>
<link rel="canonical" href="${escAttr(canonical)}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700;900&family=Heebo:wght@400;700&display=swap" rel="stylesheet"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="ציר הזמן של עם ישראל"/>
<meta property="og:title" content="${escAttr(title)}"/>
<meta property="og:description" content="${escAttr(description)}"/>
<meta property="og:url" content="${escAttr(canonical)}"/>
<meta property="og:image" content="${img}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:locale" content="he_IL"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escAttr(title)}"/>
<meta name="twitter:description" content="${escAttr(description)}"/>
<meta name="twitter:image" content="${img}"/>
<style>${STYLE}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body><div class="wrap">
<header><a href="/">← ציר הזמן של עם ישראל</a></header>
${body}
<footer>חלק מ<a href="/">ציר הזמן של עם ישראל</a> · מהאבות ועד חורבן בית שני · <a href="/p/">מפת האתר</a></footer>
</div></body>
</html>`;
}

function itemPage(it) {
  const km = KINDS[it.kind];
  const desc = clean(it.description || '');
  const metaDesc = truncate(`${it.name} — ${km.label}. ${desc}`, 155);
  const dates = formatRange(it.start, it.end, 'tradition');
  const canonical = urlOf(it);

  const srcHtml = it.source
    ? sourceSegments(it.source).map((seg) =>
        seg.href
          ? `<a href="${escAttr(seg.href)}" target="_blank" rel="noopener">${esc(seg.text)}</a>`
          : esc(seg.text)
      ).join('; ')
    : '';

  const era = periodOf(it);
  const rows = [];
  if (era) rows.push(`<div class="row"><b>תקופה:</b> <a href="/p/period/${era.id}">${esc(era.name)}</a> <span class="dim">(${era.start}–${era.end})</span></div>`);
  if (it.reignText) rows.push(`<div class="row"><b>משך המלוכה:</b> ${esc(it.reignText)}</div>`);
  if (it.lifeText) rows.push(`<div class="row"><b>שנות חיים:</b> ${esc(it.lifeText)}</div>`);
  if (it.tenureText) rows.push(`<div class="row"><b>הנהגה:</b> ${esc(it.tenureText)}</div>`);
  if (it.kings) rows.push(`<div class="row"><b>בימי:</b> ${esc(it.kings)}</div>`);
  if (it.empire) rows.push(`<div class="row"><b>מעצמה:</b> ${esc(it.empire)}</div>`);

  const sibs = byKind[it.kind];
  const i = sibs.findIndex((s) => s.id === it.id);
  const prev = sibs[i - 1], next = sibs[i + 1];
  const rel = `<nav class="rel">
${prev ? `<a href="/p/${prev.kind}/${prev.id}">← ${esc(prev.name)}</a>` : '<span></span>'}
${next ? `<a href="/p/${next.kind}/${next.id}">${esc(next.name)} →</a>` : '<span></span>'}
</nav>`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': km.schema,
    name: it.name,
    description: desc,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'ציר הזמן של עם ישראל', url: SITE + '/' },
  };

  const contemps = contemporariesOf(it);
  const contempHtml = contemps.length ? `
<section class="related">
  <h2>בני הזמן</h2>
  <p class="related-sub">מי שחי או התרחש במקביל ל${esc(it.name)}:</p>
  <ul class="chips">
    ${contemps.map((c) => `<li><a href="/p/${c.kind}/${c.id}"><span class="cl-name">${esc(c.name)}</span><span class="cl-kind">${esc(KINDS[c.kind].label)}</span></a></li>`).join('\n    ')}
  </ul>
</section>` : '';

  const body = `
<div class="chip">${esc(km.label)}</div>
<h1>${esc(it.name)}</h1>
<div class="dates">${esc(dates)}</div>
${rows.join('\n')}
<p class="desc">${esc(desc)}</p>
${srcHtml ? `<div class="src"><b>מקור:</b> ${srcHtml}</div>` : ''}
<a class="cta" href="/?sel=${it.kind}:${it.id}">פתחו בציר הזמן האינטראקטיבי ←</a>
${contempHtml}
${rel}`;

  return shell({ title: `${it.name} — ${km.label} | ציר הזמן של עם ישראל`, description: metaDesc, canonical, jsonld, body,
    ogImage: `${SITE}/og/${it.kind}/${it.id}.jpg` });
}

// דף תקופה — מרכז את כל מי שחי/התרחש בה
function periodPage(p, i) {
  const list = itemsInPeriod(p);
  const groups = {};
  for (const it of list) (groups[KINDS[it.kind].group] ||= []).push(it);
  const prev = sortedPeriods[i - 1], next = sortedPeriods[i + 1];
  const metaDesc = truncate(`${p.name} (${p.start}–${p.end}) — כל הדמויות, האירועים וספרי התנ״ך של התקופה: ${list.slice(0, 6).map((x) => x.name).join(', ')}`, 155);
  const body = `
<div class="chip">תקופה</div>
<h1>${esc(p.name)}</h1>
<div class="dates">${esc(formatRange(p.start, p.end, 'tradition'))}</div>
<p class="desc">${esc(`${list.length} דמויות, אירועים וספרים מתוארכים לתקופה זו.`)}</p>
<a class="cta" href="/">פתחו בציר הזמן האינטראקטיבי ←</a>
<div class="idx">
${Object.entries(groups).map(([g, arr]) => `<h2>${esc(g)}</h2>
<ul>${arr.map((it) => `<li><a href="/p/${it.kind}/${it.id}">${esc(it.name)}</a></li>`).join('')}</ul>`).join('\n')}
</div>
<nav class="rel">
${prev ? `<a href="/p/period/${prev.id}">← ${esc(prev.name)}</a>` : '<span></span>'}
${next ? `<a href="/p/period/${next.id}">${esc(next.name)} →</a>` : '<span></span>'}
</nav>`;
  return shell({
    title: `${p.name} (${p.start}–${p.end}) | ציר הזמן של עם ישראל`,
    description: metaDesc,
    canonical: periodUrl(p),
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: p.name,
      description: metaDesc,
      url: periodUrl(p),
      isPartOf: { '@type': 'WebSite', name: 'ציר הזמן של עם ישראל', url: SITE + '/' },
    },
    body,
    ogImage: `${SITE}/og/period/${p.id}.jpg`,
  });
}

// ---- כתיבה ----
let count = 0;
for (const it of items) {
  const dir = join(DIST, 'p', it.kind, it.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), itemPage(it));
  writeCard(DIST, join('og', it.kind, `${it.id}.jpg`), {
    name: it.name,
    kindLabel: KINDS[it.kind].label,
    dates: formatRange(it.start, it.end, 'tradition'),
  });
  count++;
}
sortedPeriods.forEach((p, i) => {
  const dir = join(DIST, 'p', 'period', p.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), periodPage(p, i));
  writeCard(DIST, join('og', 'period', `${p.id}.jpg`), {
    name: p.name,
    kindLabel: 'תקופה',
    dates: formatRange(p.start, p.end, 'tradition'),
  });
});

// דף אינדקס /p/
const groups = {};
for (const it of items) {
  const g = KINDS[it.kind].group;
  (groups[g] ||= []).push(it);
}
const idxBody = `<div class="chip">מפת האתר</div>
<h1>כל הדמויות והאירועים</h1>
<p class="desc">רשימת כל הדמויות, האירועים וספרי התנ״ך שעל ציר הזמן. לחצו על שם כדי לקרוא עליו, או פתחו את <a href="/">הציר האינטראקטיבי</a>.</p>
<div class="idx">
<h2>תקופות</h2>
<ul>${sortedPeriods.map((p) => `<li><a href="/p/period/${p.id}">${esc(p.name)}</a></li>`).join('')}</ul>
${Object.entries(groups).map(([g, list]) => `<h2>${esc(g)}</h2>
<ul>${list.map((it) => `<li><a href="/p/${it.kind}/${it.id}">${esc(it.name)}</a></li>`).join('')}</ul>`).join('\n')}
</div>`;
mkdirSync(join(DIST, 'p'), { recursive: true });
writeFileSync(join(DIST, 'p', 'index.html'), shell({
  title: 'מפת האתר — כל הדמויות והאירועים | ציר הזמן של עם ישראל',
  description: 'רשימת כל הדמויות, האירועים וספרי התנ״ך שעל ציר הזמן של עם ישראל — מהאבות ועד חורבן בית שני.',
  canonical: `${SITE}/p/`,
  jsonld: null,
  body: idxBody,
}));

// sitemap.xml
const urls = [`${SITE}/`, `${SITE}/p/`, ...sortedPeriods.map(periodUrl), ...items.map(urlOf)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;
writeFileSync(join(DIST, 'sitemap.xml'), sitemap);

// robots.txt
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

// הזרקת JSON-LD של האתר + קישור זחילה ל-index.html הראשי
const indexPath = join(DIST, 'index.html');
let html = readFileSync(indexPath, 'utf8');
const siteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ציר הזמן של עם ישראל',
  url: SITE + '/',
  description: 'ציר זמן אינטראקטיבי של תולדות עם ישראל — מהאבות ועד חורבן בית שני.',
  inLanguage: 'he',
};
if (!html.includes('application/ld+json')) {
  html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(siteLd)}</script>\n</head>`);
}
if (!html.includes('id="crawl-index"')) {
  html = html.replace('</body>', `<noscript><nav id="crawl-index"><a href="/p/">מפת האתר — כל הדמויות והאירועים</a></nav></noscript>\n</body>`);
}
writeFileSync(indexPath, html);

console.log(`prerender: ${count} item pages + ${sortedPeriods.length} period pages + index + sitemap (${urls.length} urls) + robots`);
