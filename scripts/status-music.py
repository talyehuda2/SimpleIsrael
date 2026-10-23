"""מוזיקת רקע לסרטוני הסטטוס - מסונתזת כאן, בלי קובץ של אף אחד.

למה לא שיר מוכן: לשיר יש בעלים, ווואטסאפ ופייסבוק מורידים או משתיקים סרטון
עם מוזיקה מוגנת. צליל שנוצר כאן שייך לאתר.

הצליל: שטיח של אקורדים רכים (פד) וארפג'ו של "נבל" מעליו, ברה מז'ור איטי
(D - Bm - G - A), עם הדהוד ודעיכה בסוף. נועד לשבת מתחת לטקסט ולא למשוך תשומת לב.

שימוש:
  python3 scripts/status-music.py <שניות> <פלט.wav>
"""
import sys
import wave
import numpy as np

SR = 44100
dur = float(sys.argv[1]) if len(sys.argv) > 1 else 30.0
out = sys.argv[2] if len(sys.argv) > 2 else 'music.wav'
n = int(dur * SR)
t = np.arange(n) / SR
rng = np.random.default_rng(7)  # זרע קבוע - אותו צליל בכל הרצה


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


# אקורד לכל 3.4 שניות: שורש בבס, ושלושה צלילים באמצע
CHORDS = [
    (50, [62, 66, 69]),  # D
    (47, [62, 66, 71]),  # Bm
    (43, [62, 67, 71]),  # G
    (45, [61, 64, 69]),  # A
]
BAR = 3.4

pad = np.zeros(n)
harp = np.zeros(n)
for k in range(int(np.ceil(dur / BAR)) + 1):
    root, notes = CHORDS[k % len(CHORDS)]
    s0 = k * BAR
    # פד: עלייה ודעיכה רכות שחופפות לאקורד הבא, כדי שלא יהיה "מדרגה" בין אקורדים
    a, b = int(s0 * SR), min(n, int((s0 + BAR + 1.2) * SR))
    if a >= n:
        break
    seg = t[a:b] - s0
    env = np.minimum(1, seg / 1.0) * np.clip((BAR + 1.2 - seg) / 1.2, 0, 1)
    for m, g in [(root - 12, 0.5), (root, 0.35)] + [(x, 0.22) for x in notes]:
        f = hz(m)
        for det in (-0.12, 0.12):  # שני מתנדים קרובים - חום במקום צליל "אלקטרוני"
            ph = rng.uniform(0, 2 * np.pi)
            pad[a:b] += g * env * (np.sin(2 * np.pi * (f + det) * seg + ph) + 0.15 * np.sin(4 * np.pi * (f + det) * seg + ph))
    # נבל: שמיניות עולות על צלילי האקורד, אוקטבה למעלה בחצי השני
    arp = notes + [x + 12 for x in notes[:2]]
    step = BAR / 8
    for j in range(8):
        st = s0 + j * step + 0.01 * rng.standard_normal()
        if st >= dur - 1.5:
            break
        m = arp[j % len(arp)] + (12 if j >= 4 else 0)
        f = hz(m)
        a2 = int(st * SR)
        L = min(n - a2, int(2.2 * SR))
        if L <= 0:
            continue
        s = np.arange(L) / SR
        e = np.exp(-s * 2.4) * np.minimum(1, s / 0.004)
        tone = np.sin(2 * np.pi * f * s) + 0.3 * np.sin(4 * np.pi * f * s) * np.exp(-s * 3) + 0.1 * np.sin(6 * np.pi * f * s) * np.exp(-s * 5)
        harp[a2:a2 + L] += 0.16 * (0.8 + 0.2 * rng.random()) * e * tone


def reverb(x, secs=2.6):
    """הדהוד: קונבולוציה ברעש שדועך - חלל רך, בלי ספרייה"""
    L = int(secs * SR)
    ir = rng.standard_normal(L) * np.exp(-np.arange(L) / SR * 3.0)
    ir[:int(0.02 * SR)] = 0
    m = 1 << int(np.ceil(np.log2(len(x) + L)))
    y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:len(x)]
    return y / (np.abs(y).max() + 1e-9)


mixL = 0.55 * pad / np.abs(pad).max() + 0.45 * harp / np.abs(harp).max()
wet = reverb(mixL)
left = 0.7 * mixL + 0.45 * wet
right = 0.7 * mixL + 0.45 * np.roll(wet, int(0.013 * SR))  # רוחב סטריאו קל
st = np.stack([left, right], 1)
fade = np.minimum(1, t / 1.5) * np.clip((dur - t) / 2.5, 0, 1)
st *= fade[:, None]
st = st / np.abs(st).max() * 0.42  # שקט: מתחת לקול, אם יוסיפו קריינות
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print(f'✓ {out}  {dur:.1f} שניות')
