"""מוזיקת רקע לסרטוני הסטטוס - מסונתזת כאן, בלי קובץ של אף אחד.

למה לא שיר מוכן: לשיר יש בעלים, ווואטסאפ ופייסבוק מורידים או משתיקים סרטון
עם מוזיקה מוגנת. צליל שנוצר כאן שייך לאתר.

שני סגנונות:
  desert (ברירת המחדל) - צליל מזרחי-מדברי: בורדון (צליל עומד) של רה ולה, חליל
    נאי בסולם פריגי-דומיננטי (רה "אהבה רבה" / פרייגיש: רה מי-במול פה-דיאז סול
    לה סי-במול דו - הסולם של הניגון היהודי והמזרחי), פריטת עוד על הפעמות
    החזקות ותוף מסגרת רך. בעל האתר אמר שהמז'ור "לא מתאים לווייב של התנ"ך".
  calm - אקורדים רכים ונבל ברה מז'ור. הגרסה הראשונה.

שימוש:
  python3 scripts/status-music.py <שניות> <פלט.wav> [desert|calm]
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


dry = calm() if style == 'calm' else desert()
wet = reverb(dry, 3.2, 2.4)
left = 0.72 * dry + 0.4 * wet
right = 0.72 * dry + 0.4 * np.roll(wet, int(0.013 * SR))  # רוחב סטריאו קל
st = np.stack([left, right], 1)
fade = np.minimum(1, t / 1.5) * np.clip((dur - t) / 2.5, 0, 1)
st *= fade[:, None]
st = st / np.abs(st).max() * 0.42  # שקט: מתחת לקול, אם יוסיפו קריינות
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print(f'✓ {out}  {dur:.1f} שניות ({style})')
