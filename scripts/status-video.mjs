/* סרטון סטטוס לוואטסאפ (1080x1920) מתוך סדרת איורים וקובץ תוכן אחד.

   כל סצנה: איור לאורך, תנועה איטית פנימה (Ken Burns עדין), והטקסט נכנס בדעיכה
   בחלק העליון הריק של האיור. בין סצנות - מעבר רך (xfade), בלי קפיצות.

   הטקסט מצויר בדפדפן ולא ב-ffmpeg: רק דפדפן מסדר עברית (bidi, ניקוד, מירכאות)
   נכון - drawtext של ffmpeg כותב עברית הפוכה. לכן כל סצנה מקבלת שכבת PNG שקופה
   בגופן של שאר הסטטוסים (פרנק-רוהל), והאיור עצמו נשאר נקי מטקסט. איור שבו
   צ'אט GPT כתב עברית יצא עם ריבועים במקום אותיות.

   שימוש:
     node scripts/status-video.mjs scripts/status/video/<שם>.json
   הפלט: status-out/video-<שם>/<שם>.mp4 (ב-.gitignore).
   בסביבה בלי Chrome: STATUS_BROWSER=<נתיב ל-chromium>. דורש ffmpeg.

   שדות סצנה: img (בתוך dir), dur (שניות, ברירת מחדל 4.5), eyebrow, title, size
   (גודל הכותרת), top (גובה הטקסט, כשהשמיים באיור נמוכים), v (פסוק, במירכאות), ref, sub, url (קופסת כתובת האתר בסוף). */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FD = join(ROOT, 'node_modules', '@expo-google-fonts', 'frank-ruhl-libre');
const W = 1080, H = 1920, FPS = 30, XF = 0.8;

const specPath = process.argv[2];
if (!specPath) { console.error('שימוש: node scripts/status-video.mjs scripts/status/video/<שם>.json'); process.exit(1); }
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const name = basename(specPath, '.json');
const OUT = join(ROOT, 'status-out', `video-${name}`);
mkdirSync(OUT, { recursive: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
/* שכבת הטקסט: אותה היררכיה של שקפי הסטטוס - שורת גג, קו, כותרת בכחול, פסוק ומשנה בחום.
   הילה רכה בצבע הקלף סביב האותיות, כדי שיקראו גם כשהתנועה מכניסה פרט מהאיור מתחתיהן. */
const layer = (s) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:F;font-weight:500;src:url(file://${FD}/500Medium/FrankRuhlLibre_500Medium.ttf)}
@font-face{font-family:F;font-weight:700;src:url(file://${FD}/700Bold/FrankRuhlLibre_700Bold.ttf)}
@font-face{font-family:F;font-weight:900;src:url(file://${FD}/900Black/FrankRuhlLibre_900Black.ttf)}
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;background:transparent;font-family:F,serif;overflow:hidden}
.box{position:absolute;top:${s.top || 190}px;left:90px;right:90px;text-align:center}
.glow{text-shadow:0 0 10px #f6e7c6,0 0 22px #f6e7c6,0 0 40px rgb(246 231 198 / .9)}
.ey{font-weight:700;font-size:42px;color:#6b4a0f}
.rule{width:300px;height:3px;background:#a8842c;margin:26px auto 34px}
h1{font-weight:900;font-size:${s.size || 120}px;line-height:1.08;color:#163a57}
.v{font-weight:700;font-size:62px;line-height:1.3;color:#4a330c;margin-top:34px}
.ref{font-weight:700;font-size:36px;color:#7a5b16;margin-top:14px}
.sub{font-weight:700;font-size:50px;line-height:1.35;color:#4a330c;margin-top:30px}
.url{display:inline-block;margin-top:50px;background:#163a57;color:#fbf5e7;font-weight:900;font-size:62px;
  padding:22px 54px 28px;border-radius:26px;direction:ltr}
.ch{font-weight:700;font-size:38px;color:#1f6b3a;margin-top:26px}
</style></head><body><div class="box glow">
${s.eyebrow ? `<div class="ey">${esc(s.eyebrow)}</div><div class="rule"></div>` : ''}
<h1>${esc(s.title)}</h1>
${s.v ? `<div class="v">״${esc(s.v)}״</div>` : ''}
${s.sub ? `<div class="sub">${esc(s.sub)}</div>` : ''}
${s.ref ? `<div class="ref">${esc(s.ref)}</div>` : ''}
${s.url ? `<div class="url" style="text-shadow:none">${esc(s.url)}</div><div class="ch">📢 ובערוץ הוואטסאפ: ציר הזמן של עם ישראל</div>` : ''}
</div></body></html>`;

const exe = process.env.STATUS_BROWSER;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const layers = [];
for (const [i, s] of spec.scenes.entries()) {
  await page.setContent(layer(s), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // בדיקה: הטקסט חייב להיגמר בשליש העליון, מעל האיור
  const bottom = await page.evaluate(() => document.querySelector('.box').getBoundingClientRect().bottom);
  if (bottom > H * 0.5) throw new Error(`סצנה ${i + 1}: הטקסט יורד עד ${Math.round(bottom)}px - ארוך מדי`);
  const f = join(OUT, `text-${String(i + 1).padStart(2, '0')}.png`);
  await page.screenshot({ path: f, omitBackground: true });
  layers.push(f);
}
await browser.close();

/* כל סצנה לקליפ נפרד: האיור מוגדל פי 2 לפני zoompan, אחרת התנועה רועדת
   (zoompan מעגל לפיקסל שלם). זום מ-1.0 עד 1.06 לאורך כל הסצנה - עדין. */
const clips = [];
for (const [i, s] of spec.scenes.entries()) {
  const dur = s.dur || 4.5;
  const n = Math.round(dur * FPS);
  const img = join(ROOT, spec.dir, s.img);
  if (!existsSync(img)) throw new Error(`חסר איור: ${img}`);
  const out = join(OUT, `clip-${i + 1}.mp4`);
  const vf = `[0:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},`
    + `zoompan=z='1+0.06*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${W}x${H}:fps=${FPS},setsar=1[bg];`
    + `[1:v]format=rgba,fade=in:st=0.5:d=0.7:alpha=1[tx];[bg][tx]overlay=0:0,format=yuv420p`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-i', img, '-loop', '1', '-t', String(dur), '-i', layers[i],
    '-filter_complex', vf, '-t', String(dur), '-r', String(FPS), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', out]);
  clips.push({ out, dur });
}

// שרשור במעברי xfade, ודעיכה מהשחור בתחילה ואליו בסוף
let graph = '', last = '[0:v]', t = 0;
for (let i = 1; i < clips.length; i++) {
  t += clips[i - 1].dur - XF;
  graph += `${last}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${t.toFixed(2)}[x${i}];`;
  last = `[x${i}]`;
}
const total = t + clips[clips.length - 1].dur;
graph += `${last}fade=in:st=0:d=0.6,fade=out:st=${(total - 0.8).toFixed(2)}:d=0.8,format=yuv420p[v]`;
const final = join(OUT, `${name}.mp4`);
/* פס קול: music בקובץ התוכן (true = 'desert', המזרחי; או 'calm') - מוזיקה רכה שמסונתזת לאורך הסרטון בדיוק
   (scripts/status-music.py, בלי שיר של אף אחד). בלי - ערוץ שמע שקט, כי וואטסאפ
   ומכשירים מסוימים מתנהגים טוב יותר עם ערוץ שמע, גם ריק. */
let audio = ['-f', 'lavfi', '-t', String(total), '-i', 'anullsrc=r=44100:cl=stereo'];
if (spec.music) {
  const wav = join(OUT, 'music.wav');
  execFileSync('python3', [join(ROOT, 'scripts', 'status-music.py'), total.toFixed(2), wav,
    typeof spec.music === 'string' ? spec.music : 'desert'], { stdio: 'inherit' });
  audio = ['-i', wav];
}
execFileSync('ffmpeg', ['-y', '-v', 'error', ...clips.flatMap((c) => ['-i', c.out]), ...audio,
  '-filter_complex', graph, '-map', '[v]', '-map', `${clips.length}:a`, '-shortest',
  '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', final]);
console.log(`✓ ${final}  ${total.toFixed(1)} שניות, ${clips.length} סצנות`);
