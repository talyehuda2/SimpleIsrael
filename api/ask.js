/* סוכן השאלות של האתר. רץ בשרת (Vercel Function) ולא בדפדפן, משתי סיבות:
   מפתח ה-API לא נחשף לאף גולש, וההגבלות באמת נאכפות - הגבלה בצד לקוח
   היא הצעה מנומסת שכל אחד עוקף.

   שני משתני סביבה נדרשים, שניהם מוגדרים בדשבורד של Vercel ולעולם לא בקוד:
     ANTHROPIC_API_KEY - המפתח
     ADMIN_TOKEN       - אותו טוקן ניהול שכבר משמש למחיקת תגובות

   בשלב הזה הסוכן פתוח רק למנהל. הגבלת קצב לפי IP, מטמון תשובות ומתג
   תקציב יומי הם הגנות מפני שימוש ציבורי - הם ייכנסו כשזה ייפתח לכולם. */
import Anthropic from '@anthropic-ai/sdk';
import { INDEX, getRecords, getContemporaries } from './_lib/corpus.js';

/* Sonnet 5 ולא Opus: המשימה כאן היא שליפה וניסוח שלוש שורות מתוך רשומה
   שהכלי כבר הגיש - לא הסקה. התמחור נמוך פי 2.5 בכל עמודה (קלט, פלט,
   וקריאת מטמון), וזה מה שהופך שאלה ציבורית לבת-קיימא. */
const MODEL = 'claude-sonnet-5';
const MAX_QUESTION_CHARS = 500;   // שכבה 2: תקרת קלט, נאכפת לפני שנוגעים ב-API
const MAX_TOKENS = 600;           // שכבה 1: תקרת פלט - החלק היקר פי חמש
const MAX_TOOL_ROUNDS = 4;        // עצירה קשיחה אם המודל נתקע בלולאת שליפות

/* תמחור ל-1M טוקנים (platform.claude.com/docs/en/about-claude/pricing).
   החישוב יושב בשרת ולא בדפדפן משתי סיבות: כאן ידוע איזה מודל באמת רץ,
   ושכבת ההגבלות הבאה תצטרך את המספר הזה כדי לסכם תקציב יומי. */
const PRICE = {
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.20, cacheWrite: 2.50 },
  'claude-opus-5':   { input: 5, output: 25, cacheRead: 0.50, cacheWrite: 6.25 },
};
const costOf = (u) => {
  const p = PRICE[MODEL];
  if (!p) return null;   // מודל שלא תומחר - עדיף בלי מספר מאשר מספר שגוי
  return (u.input * p.input + u.output * p.output
    + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1e4;   // באגורות
};

const SYSTEM = `אתה עוזר המחקר של "ציר הזמן של עם ישראל" - אתר על ההיסטוריה המקראית מהאבות ועד חורבן בית שני, לפי הכרונולוגיה המסורתית (סדר עולם).

כללי מפתח:
- ענה **רק** על סמך מה שנשלף מהכלים. אם המידע לא נמצא באתר - אמור זאת במפורש ואל תשלים מהידע הכללי שלך.
- כל השנים באתר הן **לבריאה** לפי סדר עולם, לא לספירה. אל תמיר ואל תערבב.
- ענה בעברית, בשתיים עד ארבע שורות. זו תיבת שאלות באתר, לא חיבור.
- אם השאלה אינה על ההיסטוריה המקראית שבאתר - אמור בנימוס שזה מחוץ לתחום.

קישורים: כשאתה מזכיר דמות, מקום, אירוע או תקופה שיש להם מזהה באינדקס, עטוף את השם בסוגריים כפולים עם המזהה כך:
[[prophet:eliyahu|אליהו]]
הממשק הופך את זה לקישור לחיץ. אל תמציא מזהים - השתמש רק במזהים שראית באינדקס או בתוצאות הכלים.

האינדקס של כל מה שקיים באתר:

${INDEX}`;

const TOOLS = [
  {
    name: 'get_records',
    description: 'שליפת הרשומות המלאות (תיאור, פסוק, מקור, תחנות מסע) לפי מזהים מהאינדקס. אפשר לשלוף עד 8 בבת אחת - עדיף קריאה אחת עם כמה מזהים מאשר כמה קריאות.',
    input_schema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: { type: 'string' },
          description: 'מזהים כפי שמופיעים באינדקס, למשל ["prophet:eliyahu", "israel:achav", "place:ירושלים"]',
        },
      },
      required: ['keys'],
    },
  },
  {
    name: 'get_contemporaries',
    description: 'מי חי או התרחש במקביל לפריט מסוים - לשאלות מסוג "מי היה בזמן של" או "האם X ו-Y נפגשו".',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'מזהה יחיד, למשל "prophet:eliyahu"' },
      },
      required: ['key'],
    },
  },
];

function runTool(name, input) {
  if (name === 'get_records') return getRecords(Array.isArray(input.keys) ? input.keys : []);
  if (name === 'get_contemporaries') return getContemporaries(input.key);
  return { error: `כלי לא מוכר: ${name}` };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST בלבד' });
  }

  const adminToken = process.env.ADMIN_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!adminToken || !apiKey) {
    return res.status(500).json({ error: 'השרת לא הוגדר: חסר ANTHROPIC_API_KEY או ADMIN_TOKEN' });
  }
  // בשלב הזה הסוכן סגור למנהל בלבד
  if ((req.headers['x-admin-token'] || '') !== adminToken) {
    return res.status(403).json({ error: 'הסוכן פתוח כרגע למנהל בלבד' });
  }

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question) return res.status(400).json({ error: 'לא נשלחה שאלה' });
  if (question.length > MAX_QUESTION_CHARS) {
    return res.status(400).json({ error: `השאלה ארוכה מדי (${question.length} תווים, המקסימום ${MAX_QUESTION_CHARS})` });
  }

  const client = new Anthropic({ apiKey });
  const messages = [{ role: 'user', content: question }];
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const fetched = [];

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // האינדקס זהה בכל שאלה - המטמון הופך אותו מ-2$ למיליון ל-0.20$.
        // חייב להיות ראשון ויציב: שינוי בייט אחד לפניו מבטל את המטמון.
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        // שאלה עובדתית שהכלי כבר מגיש לה את הרשומה לא דורשת התלבטות ארוכה
        output_config: { effort: 'low' },
        tools: TOOLS,
        messages,
      });

      usage.input += response.usage.input_tokens || 0;
      usage.output += response.usage.output_tokens || 0;
      usage.cacheRead += response.usage.cache_read_input_tokens || 0;
      usage.cacheWrite += response.usage.cache_creation_input_tokens || 0;

      if (response.stop_reason === 'refusal') {
        return res.status(200).json({ answer: 'לא הצלחתי לענות על השאלה הזו.', usage, fetched, costCents: costOf(usage) });
      }

      const toolUses = response.content.filter((b) => b.type === 'tool_use');
      if (!toolUses.length) {
        const answer = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        return res.status(200).json({
          answer: answer || 'לא הצלחתי לנסח תשובה.',
          truncated: response.stop_reason === 'max_tokens',
          usage,
          fetched,
          costCents: costOf(usage),
        });
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: toolUses.map((t) => {
          const result = runTool(t.name, t.input || {});
          if (t.name === 'get_records' && Array.isArray(t.input?.keys)) fetched.push(...t.input.keys);
          return { type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(result) };
        }),
      });
    }
    // הגענו לתקרת הסבבים בלי תשובה - עדיף להודות מאשר להמשיך לשרוף טוקנים
    return res.status(200).json({ answer: 'השאלה הסתבכה יותר מדי. נסו לנסח אותה בצורה ממוקדת יותר.', usage, fetched, costCents: costOf(usage) });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'יותר מדי בקשות, נסו שוב בעוד רגע' });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: 'מפתח ה-API אינו תקין' });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: `שגיאה מ-Claude (${err.status})` });
    }
    console.error('ask handler failed', err);
    return res.status(500).json({ error: 'שגיאה בשרת' });
  }
}
