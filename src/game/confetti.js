/* קונפטי לסוף סבב מוצלח - canvas אחד, בלי ספרייה.

   בלי ספרייה בכוונה: ה-CSP של האתר מתיר סקריפטים רק מהדומיין שלנו, והאפקט
   כולו הוא כמה עשרות שורות. הצבעים הם צבעי הסוגים של האתר ולא קשת כללית,
   כך שהחגיגה נראית חלק מהמסך.

   מי שביקש במכשיר להפחית תנועה (prefers-reduced-motion) לא יקבל קונפטי:
   ההודעה הגדולה בראש המסך אומרת את אותו הדבר. */
const COLORS = ['#b28a2b', '#d9b755', '#163a57', '#9c2b50', '#245c93', '#4f7a33', '#6a3ca0', '#b0392c'];

export function confetti(count = 150) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  // שני תותחים בפינות העליונות, יורים פנימה ולמעלה
  const parts = Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0;
    const angle = (left ? -60 : -120) * Math.PI / 180 + (Math.random() - 0.5) * 0.9;
    const speed = 7 + Math.random() * 9;
    return {
      x: left ? W * 0.1 : W * 0.9, y: H * 0.35,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 6, h: 3 + Math.random() * 5,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
      color: COLORS[i % COLORS.length], life: 0,
    };
  });

  const DURATION = 2600;
  const t0 = performance.now();
  function frame(now) {
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.28;          // כובד
      p.vx *= 0.985;         // התנגדות אוויר
      p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / DURATION);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
      ctx.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
