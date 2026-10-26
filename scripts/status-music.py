"""מוזיקת רקע לסרטוני הסטטוס - מסונתזת כאן, בלי קובץ של אף אחד.

למה לא שיר מוכן: לשיר יש בעלים, ווואטסאפ ופייסבוק מורידים או משתיקים סרטון
עם מוזיקה מוגנת. צליל שנוצר כאן שייך לאתר.

שני סגנונות:
  desert (ברירת המחדל) - צליל מזרחי-מדברי: בורדון (צליל עומד) של רה ולה, חליל
    נאי בסולם פריגי-דומיננטי (רה "אהבה רבה" / פרייגיש: רה מי-במול פה-דיאז סול
    לה סי-במול דו - הסולם של הניגון היהודי והמזרחי), פריטת עוד על הפעמות
    החזקות ותוף מסגרת רך. בעל האתר אמר שהמז'ור "לא מתאים לווייב של התנ"ך".
  calm - אקורדים רכים ונבל ברה מז'ור. הגרסה הראשונה.
  lyre - נבל דוד: פריטות איטיות במינור, בלי תוף. שקט ומהורהר.
  royal - מלכותי: מיתרים נמוכים שמתעצמים וטימפני, נגמר באקורד מז'ור. לסיפורי מלכים.
  shepherd - חליל רועים בדורי ונבל קל, בלי בס. קליל ואוורירי.
  kinnor - כינור בריקוד קל עם תוף מרים עדין. השמח מכולם.
  dawn - חליל ונבל בדואט, פנטטוני, לאט ובהיר.
  (lyre, royal ו-chant יצאו לבעל האתר כבדים מדי לסטטוס.)
  chant - מקהלה: "אהה" של קולות גבריים בסולם אהבה רבה, על צליל עומד. תפילתי.

שימוש:
  python3 scripts/status-music.py <שניות> <פלט.wav> [desert|calm|lyre|royal|chant|shepherd|kinnor|dawn]
"""
import sys
import wave
import numpy as np

SR = 44100
dur = float(sys.argv[1]) if len(sys.argv) > 1 else 30.0
out = sys.argv[2] if len(sys.argv) > 2 else 'music.wav'
style = sys.argv[3] if len(sys.argv) > 3 else 'desert'
n = int(dur * SR)
t = np.arange(n) / SR
rng = np.random.default_rng(7)  # זרע קבוע - אותו צליל בכל הרצה


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def place(buf, start, sig, gain=1.0):
    a = int(start * SR)
    if a >= len(buf):
        return
    L = min(len(sig), len(buf) - a)
    buf[a:a + L] += gain * sig[:L]


def reverb(x, secs=2.6, decay=3.0):
    """הדהוד: קונבולוציה ברעש שדועך - חלל רך, בלי ספרייה"""
    L = int(secs * SR)
    ir = rng.standard_normal(L) * np.exp(-np.arange(L) / SR * decay)
    ir[:int(0.02 * SR)] = 0
    m = 1 << int(np.ceil(np.log2(len(x) + L)))
    y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:len(x)]
    return y / (np.abs(y).max() + 1e-9)


def lowpass(x, cut):
    """מסנן פשוט בתחום התדר - מרכך צליל חד"""
    m = 1 << int(np.ceil(np.log2(len(x))))
    X = np.fft.rfft(x, m)
    f = np.fft.rfftfreq(m, 1 / SR)
    X *= 1 / (1 + (f / cut) ** 4)
    return np.fft.irfft(X, m)[:len(x)]


def norm(x):
    return x / (np.abs(x).max() + 1e-9)


def calm():
    CHORDS = [(50, [62, 66, 69]), (47, [62, 66, 71]), (43, [62, 67, 71]), (45, [61, 64, 69])]  # D Bm G A
    BAR = 3.4
    pad, harp = np.zeros(n), np.zeros(n)
    for k in range(int(np.ceil(dur / BAR)) + 1):
        root, notes = CHORDS[k % len(CHORDS)]
        s0 = k * BAR
        a, b = int(s0 * SR), min(n, int((s0 + BAR + 1.2) * SR))
        if a >= n:
            break
        seg = t[a:b] - s0
        env = np.minimum(1, seg / 1.0) * np.clip((BAR + 1.2 - seg) / 1.2, 0, 1)
        for m, g in [(root - 12, 0.5), (root, 0.35)] + [(x, 0.22) for x in notes]:
            for det in (-0.12, 0.12):
                ph = rng.uniform(0, 2 * np.pi)
                f = hz(m) + det
                pad[a:b] += g * env * (np.sin(2 * np.pi * f * seg + ph) + 0.15 * np.sin(4 * np.pi * f * seg + ph))
        arp = notes + [x + 12 for x in notes[:2]]
        for j in range(8):
            st = s0 + j * BAR / 8
            if st >= dur - 1.5:
                break
            f = hz(arp[j % len(arp)] + (12 if j >= 4 else 0))
            s = np.arange(int(2.2 * SR)) / SR
            e = np.exp(-s * 2.4) * np.minimum(1, s / 0.004)
            place(harp, st, e * (np.sin(2 * np.pi * f * s) + 0.3 * np.sin(4 * np.pi * f * s) * np.exp(-s * 3)), 0.16)
    return 0.55 * norm(pad) + 0.45 * norm(harp)


def ney(f, L):
    """חליל נאי: צליל רך עם ויברטו שנכנס באיחור ונשימה (רעש מסונן) בתחילת הצליל"""
    s = np.arange(L) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * s) * np.minimum(1, s / 0.6)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    tone = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    breath = lowpass(rng.standard_normal(L), 1800) * 0.08 * np.exp(-s * 10)
    env = np.minimum(1, s / 0.18) * np.clip((L / SR - s) / 0.35, 0, 1)
    return env * (tone + breath)


def oud(f, L):
    """עוד: קרפלוס-סטרונג - מיתר פרוט שדועך, צליל חם ומעט "עצי" """
    p = int(SR / f)
    buf = lowpass(rng.standard_normal(p * 4), 3000)[:p]
    buf -= buf.mean()  # בלי רכיב DC: המסנן של המיתר משמר אותו, והוא נשמע כ"זמזום" נמוך ומכביד
    y = np.zeros(L)
    y[:p] = buf
    for i in range(p, L):
        y[i] = 0.497 * (y[i - p] + y[i - p - 1])
    return y * np.exp(-np.arange(L) / SR * 0.9)


def drum(low=True):
    """תוף מסגרת: דום (נמוך, צליל יורד) או טק (קצה העור, קצר)"""
    L = int(0.6 * SR)
    s = np.arange(L) / SR
    if low:
        f = 95 * np.exp(-s * 4) + 55
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-s * 7)
    return lowpass(rng.standard_normal(L), 1800) * np.exp(-s * 30) * 0.6


def desert():
    D = 62  # רה (D4)
    SC = {'D': 0, 'Eb': 1, 'F#': 4, 'G': 5, 'A': 7, 'Bb': 8, 'C': 10, 'd': 12}
    # שלוש פראזות של ניגון, באורך פעמות; הפראזה האחרונה חוזרת לרה
    MEL = [('A', 2), ('Bb', 1), ('A', 1), ('G', 1), ('F#', 1), ('G', 2), ('F#', 1), ('Eb', 1), ('D', 3),
           ('D', 1), ('F#', 1), ('G', 1), ('A', 1), ('Bb', 2), ('C', 1), ('Bb', 1), ('A', 3),
           ('G', 1), ('F#', 1), ('Eb', 1), ('F#', 1), ('D', 4)]
    beats = sum(b for _, b in MEL)
    intro = 2.0
    beat = (dur - intro - 2.0) / beats  # המנגינה נמתחת לאורך הסרטון
    drone, flute, pluck, perc = np.zeros(n), np.zeros(n), np.zeros(n), np.zeros(n)

    # בורדון: רה ולה נמוכים לכל אורך הקטע, עם נשימה איטית בעוצמה
    for m, g in [(38, 0.6), (45, 0.4), (50, 0.3)]:
        for det in (-0.15, 0.15):
            drone += g * np.sin(2 * np.pi * (hz(m) + det) * t + rng.uniform(0, 6.28))
    drone *= 0.75 + 0.25 * np.sin(2 * np.pi * t / 7)

    pos = intro
    for k, (nm, b) in enumerate(MEL):
        L = int((b * beat + 0.25) * SR)
        flute_note = ney(hz(D + SC[nm]), L)
        place(flute, pos, flute_note, 0.9)
        pos += b * beat

    # עוד: רה-לה בתחילת כל ארבע פעמות, ופריטה קלה של התו באמצע
    k = 0
    while intro + k * beat < dur - 2.5:
        st = intro + k * beat
        if k % 4 == 0:
            place(pluck, st, oud(hz(50), int(2.5 * SR)), 0.8)
            place(pluck, st + 0.03, oud(hz(57), int(2.5 * SR)), 0.5)
        elif k % 4 == 2:
            place(pluck, st, oud(hz(62), int(1.5 * SR)), 0.35)
        # תוף: דום . טק . | דום דום טק .
        bar = (k // 4) % 2
        pat = [True, None, False, None] if bar == 0 else [True, True, False, None]
        hit = pat[k % 4]
        if hit is not None:
            place(perc, st, drum(hit), 0.5 if hit else 0.25)
        k += 1
    # הכל מתחת ל-4.5kHz: צליל חם, בלי "רחש" של רעש שנפרט
    return lowpass(0.30 * norm(drone) + 0.42 * norm(flute) + 0.22 * norm(lowpass(pluck, 2500)) + 0.14 * norm(lowpass(perc, 1500)), 4500)


def bandpass(x, lo, hi):
    """מסנן מעבר-פס רך בתחום התדר - לפורמנטים של "קול" ולמיתרים"""
    m = 1 << int(np.ceil(np.log2(len(x))))
    X = np.fft.rfft(x, m)
    f = np.fft.rfftfreq(m, 1 / SR)
    c, w = (lo + hi) / 2, (hi - lo) / 2
    X *= 1 / (1 + ((f - c) / w) ** 4)
    return np.fft.irfft(X, m)[:len(x)]


def saw(f, L, voices=3, spread=0.18):
    """מסור רך (הרמוניות 1/n) בכמה קולות קרובים - בסיס למיתרים ולמקהלה"""
    s = np.arange(L) / SR
    y = np.zeros(L)
    for v in range(voices):
        ff = f * (1 + (v - (voices - 1) / 2) * spread / 100)
        ph = rng.uniform(0, 6.28)
        for h in range(1, 14):
            if ff * h > 6000:
                break
            y += np.sin(2 * np.pi * ff * h * s + ph * h) / h
    return y


def swell(L, att=1.2, rel=1.2):
    s = np.arange(L) / SR
    return np.minimum(1, s / att) * np.clip((L / SR - s) / rel, 0, 1)


def lyre():
    """נבל דוד: פריטות מיתר איטיות במינור (רה), בלי תוף - שקט, כמו ניגון לפני השינה.
    ארפג'ו עולה ויורד על ארבעה אקורדים, וצליל רה עמוק מתחת."""
    CH = [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [48, 55, 60, 64, 67], [45, 52, 57, 61, 64]]  # Dm Bb C A
    bar = (dur - 1.5) / 6
    harp, low = np.zeros(n), np.zeros(n)
    for k in range(7):
        notes = CH[k % 4] if k < 6 else [50, 57, 62]
        st0 = 0.8 + k * bar
        if st0 > dur - 2:
            break
        seq = notes + notes[-2:0:-1]
        step = bar / len(seq)
        for j, m in enumerate(seq):
            place(harp, st0 + j * step, oud(hz(m + 12), int(3 * SR)), 0.6 + 0.2 * (j == 0))
        place(low, st0, oud(hz(notes[0] - 12), int(4 * SR)), 0.8)
    drone = np.sin(2 * np.pi * hz(38) * t) * (0.8 + 0.2 * np.sin(2 * np.pi * t / 9))
    return lowpass(0.55 * norm(harp) + 0.25 * norm(low) + 0.2 * norm(drone), 5000)


def royal():
    """מלכותי ודרמטי: מיתרים נמוכים שמתעצמים במינור, ותוף טימפני רך בתחילת כל אקורד.
    מתאים לסיפורי מלכים - כתר, ארמון, מלחמה."""
    CH = [[38, 50, 57, 62, 65], [34, 46, 53, 58, 62], [36, 48, 55, 60, 64], [33, 45, 52, 57, 61]]  # Dm Bb C A
    bar = dur / 4
    strings, timp = np.zeros(n), np.zeros(n)
    for k in range(4):
        notes = CH[k] if k < 3 else [38, 50, 57, 62, 66]  # סיום על רה מז'ור - פתח של תקווה
        L = int((bar + 1.5) * SR)
        for i, m in enumerate(notes):
            place(strings, k * bar, swell(L, 1.8, 1.4) * saw(hz(m), L), 0.9 if i == 0 else 0.5)
        tl = int(1.6 * SR)
        s = np.arange(tl) / SR
        place(timp, k * bar + 0.05, np.sin(2 * np.pi * np.cumsum(hz(38) * (1 + 0.06 * np.exp(-s * 8))) / SR) * np.exp(-s * 3.2), 1.0)
    # קרשנדו: כל הקטע מתעצם לאט עד הסוף
    strings *= 0.55 + 0.45 * np.minimum(1, t / (dur * 0.8))
    return lowpass(0.78 * norm(lowpass(strings, 1600)) + 0.22 * norm(timp), 4000)


def chant():
    """ניגון מקהלה: "אהה" ארוך של קולות גבריים בסולם אהבה רבה, על צליל עומד.
    הקול נבנה מפורמנטים (תהודות הפה של התנועה "א") על מסור - בלי הקלטה."""
    D = 50
    SC = {'D': 0, 'Eb': 1, 'F#': 4, 'G': 5, 'A': 7, 'Bb': 8}
    MEL = [('D', 2), ('Eb', 1), ('F#', 2), ('G', 1), ('A', 3), ('G', 1), ('F#', 1), ('Eb', 1), ('D', 4)]
    beats = sum(b for _, b in MEL)
    beat = (dur - 3.0) / beats
    voice = np.zeros(n)
    pos = 1.0
    for nm, b in MEL:
        L = int((b * beat + 0.6) * SR)
        f = hz(D + SC[nm])
        s = np.arange(L) / SR
        vib = saw(f, L, voices=4, spread=0.35) * (1 + 0.004 * np.sin(2 * np.pi * 5 * s))
        place(voice, pos, swell(L, 0.35, 0.5) * vib, 1.0)
        place(voice, pos, swell(L, 0.35, 0.5) * saw(f * 1.5, L, voices=3, spread=0.3), 0.35)  # חמישית מעל
        pos += b * beat
    ah = 0.6 * bandpass(voice, 600, 900) + 0.45 * bandpass(voice, 1000, 1300) + 0.15 * bandpass(voice, 2400, 2800)
    drone = saw(hz(38), n, voices=3, spread=0.2) * (0.85 + 0.15 * np.sin(2 * np.pi * t / 8))
    return lowpass(0.7 * norm(ah) + 0.3 * norm(lowpass(drone, 500)), 4000)


def jingle(L=int(0.25 * SR)):
    """תוף מרים קטן: ענבלים - רעש בהיר וקצר, בלי ה"דום" הנמוך"""
    s = np.arange(L) / SR
    return bandpass(rng.standard_normal(L), 5000, 9000) * np.exp(-s * 22)


def tune(mel, beat, start, fn, buf, gain, octave=0, base=62):
    pos = start
    for st, b in mel:
        if st is not None:
            L = int((b * beat + 0.3) * SR)
            place(buf, pos, fn(hz(base + st + octave), L), gain)
        pos += b * beat
    return pos


def shepherd():
    """חליל רועים: מנגינה פשוטה ואוורירית בדורי (רה), ונבל קל שפורט פעם בתיבה.
    בלי בס ובלי צליל עומד - קליל, כמו רועה על גבעה."""
    # מעלות דורי: רה=0 מי=2 פה=3 סול=5 לה=7 סי=9 דו=10
    MEL = [(7, 1), (9, 1), (10, 1), (9, 1), (7, 2), (5, 1), (3, 1), (5, 2), (7, 2),
           (3, 1), (5, 1), (7, 1), (5, 1), (3, 1), (2, 1), (0, 4),
           (7, 1), (9, 1), (10, 2), (12, 2), (10, 1), (9, 1), (7, 4),
           (5, 1), (3, 1), (2, 1), (3, 1), (0, 4)]
    beats = sum(b for _, b in MEL)
    beat = (dur - 2.5) / beats
    flute, harp = np.zeros(n), np.zeros(n)
    tune(MEL, beat, 1.0, ney, flute, 0.8, octave=12)
    k = 0
    while 1.0 + k * 4 * beat < dur - 2:
        st = 1.0 + k * 4 * beat
        for j, m in enumerate([62, 69, 74] if k % 2 == 0 else [60, 67, 72]):
            place(harp, st + j * beat * 0.5, oud(hz(m), int(2.5 * SR)), 0.5)
        k += 1
    return lowpass(0.6 * norm(flute) + 0.4 * norm(harp), 6000)


def kinnor():
    """כינור (נבל קטן) בריקוד קל: מנגינה פרוטה במיקסולידי (סול), ותוף מרים עדין בכל פעמה.
    הכי שמח מבין הסגנונות - כמו "ומרים הנביאה... בתופים ובמחולות", בשקט."""
    # מיקסולידי מסול: סול=0 לה=2 סי=4 דו=5 רה=7 מי=9 פה=10
    MEL = [(0, 1), (4, 1), (7, 1), (4, 1), (5, 1), (4, 1), (2, 2),
           (2, 1), (5, 1), (9, 1), (7, 1), (5, 1), (4, 1), (0, 2),
           (7, 1), (9, 1), (10, 1), (9, 1), (7, 1), (5, 1), (4, 2),
           (2, 1), (4, 1), (5, 1), (2, 1), (0, 4)]
    beats = sum(b for _, b in MEL)
    beat = (dur - 2.5) / beats
    harp, bass, perc = np.zeros(n), np.zeros(n), np.zeros(n)
    tune(MEL, beat, 1.0, lambda f, L: oud(f, L), harp, 0.8, octave=12, base=55)
    k = 0
    while 1.0 + k * beat < dur - 1.8:
        st = 1.0 + k * beat
        if k % 4 == 0:
            place(bass, st, oud(hz(43), int(2 * SR)), 0.6)
        place(perc, st, jingle(), 0.7 if k % 2 == 0 else 0.4)
        k += 1
    return lowpass(0.84 * norm(harp) + 0.08 * norm(bass) + 0.08 * norm(perc), 9000)


def dawn():
    """שחר: חליל ונבל בדואט על סולם פנטטוני (חמישה צלילים, כמו נגינה עממית עתיקה),
    לאט ובהיר. החליל שר, והנבל עונה לו בתיבה שאחריו."""
    # פנטטוני מרה: רה=0 מי=2 פה#=4 לה=7 סי=9
    Q = [(7, 1), (9, 1), (7, 1), (4, 1), (2, 2), (4, 2)]
    A = [(4, 1), (7, 1), (9, 1), (12, 1), (9, 2), (7, 2)]
    E = [(4, 1), (2, 1), (0, 2), (None, 4)]
    beats = 2 * sum(b for _, b in Q + A) + sum(b for _, b in E)
    beat = (dur - 2.5) / beats
    flute, harp = np.zeros(n), np.zeros(n)
    pos = 1.0
    for rep in range(2):
        pos = tune(Q, beat, pos, ney, flute, 0.8, octave=12)
        pos = tune(A, beat, pos, oud, harp, 0.8, octave=12)
    tune(E, beat, pos, ney, flute, 0.8, octave=12)
    tune([(0, 1), (7, 1), (12, 4)], beat * 0.5, pos + 2 * beat, oud, harp, 0.5, octave=0)
    return lowpass(0.55 * norm(flute) + 0.45 * norm(harp), 6500)


STYLES = {'calm': calm, 'desert': desert, 'lyre': lyre, 'royal': royal, 'chant': chant, 'shepherd': shepherd, 'kinnor': kinnor, 'dawn': dawn}
dry = STYLES[style]()
wet = reverb(dry, 3.2, 2.4)
left = 0.72 * dry + 0.4 * wet
right = 0.72 * dry + 0.4 * np.roll(wet, int(0.013 * SR))  # רוחב סטריאו קל
st = np.stack([left, right], 1)
fade = np.minimum(1, t / 1.5) * np.clip((dur - t) / 2.5, 0, 1)
st *= fade[:, None]
# עוצמה אחידה בין הסגנונות: לפי הממוצע (‎-20dB‎) ולא לפי השיא - נבל פרוט חד בשיאים
# יצא בנרמול לפי שיא שקט בהרבה מהשאר. השיא נשאר מתחת ל-0.95.
rms = np.sqrt((st ** 2).mean())
st = st * min(0.1 / rms, 0.95 / np.abs(st).max())
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print(f'✓ {out}  {dur:.1f} שניות ({style})')
