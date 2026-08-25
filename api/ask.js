/* סוכן השאלות של האתר. רץ בשרת (Vercel Function) ולא בדפדפן, משתי סיבות:
   מפתח ה-API לא נחשף לאף גולש, וההגבלות באמת נאכפות - הגבלה בצד לקוח
   היא הצעה מנומסת שכל אחד עוקף.

   משתני סביבה, כולם בדשבורד של Vercel ולעולם לא בקוד:
     ANTHROPIC_API_KEY    - המפתח מ-console.anthropic.com
     ADMIN_TOKEN          - אותו טוקן ניהול שכבר משמש למחיקת תגובות
     SUPABASE_SERVICE_KEY - למטמון התשובות וליומן המכסות
     ASK_IP_SALT          - מלח לגיבוב כתובות IP
     ASK_PUBLIC=1         - פותח את הסוכן לציבור. בלעדיו: מנהל בלבד.
     ASK_ENABLED=0        - מתג הרג. חסר או כל ערך אחר = דלוק.

   ארבע שכבות הגבלה, מהזולה ליקרה: תקרת קלט (MAX_QUESTION_CHARS),
   מטמון תשובות, מכסה יומית לגולש ותקציב יומי לאתר - כולן נבדקות
   *לפני* שנוגעים ב-API. תקרת הפלט (MAX_TOKENS) חוסמת מלמעלה. */
import Anthropic from '@anthropic-ai/sdk';
import { INDEX, getRecords, getContemporaries } from './_lib/corpus.js';
import { dbReady, qhashOf, ipHashOf, askGate, logAsk } from './_lib/db.js';

/* Sonnet 5 ולא Opus: המשימה כאן היא שליפה וניסוח שלוש שורות מתוך רשומה
   שהכלי כבר הגיש - לא הסקה. התמחור נמוך פי 2.5 בכל עמודה (קלט, פלט,
   וקריאת מטמון), וזה מה שהופך שאלה ציבורית לבת-קיימא. */
const MODEL = 'claude-sonnet-5';
const MAX_QUESTION_CHARS = 500;   // שכבה 2: תקרת קלט, נאכפת לפני שנוגעים ב-API
const MAX_TOKENS = 600;           // שכבה 1: תקרת פלט - החלק היקר פי חמש
const MAX_TOOL_ROUNDS = 4;        // עצירה קשיחה אם המודל נתקע בלולאת שליפות

/* שכבה 3: המכסות. שאלה חמה עולה כ-1.25 אגורות, ולכן 150 אגורות ליום
   הן כ-120 שאלות חדשות - לפני שמטמון התשובות בכלל נכנס לתמונה.
   המספרים כאן שמרניים בכוונה: קל להעלות אחרי שבוע של נתונים אמיתיים,
   הרבה פחות נעים לגלות חשבון מפתיע. */
const MAX_PER_DAY = 3;              // שאלות חדשות לגולש, בחלון של 24 שעות
const DAILY_BUDGET_CENTS = 150;     // תקרת הוצאה יומית לאתר כולו, באגורות
const CACHE_DAYS = 30;              // כמה זמן תשובה נשמרת ומוגשת שוב

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
- אם המידע לא נמצא, אל תעצור שם: הצע מיד את הקרוב ביותר שכן קיים באתר (דמות דומה, אותה תקופה, מקום קשור) והסבר בחצי משפט למה הוא קרוב.
- כשאתה מונה פריטים - מנה את **כולם** מתוך מה שנשלף. אם אין מקום לכולם, אמור במפורש "ועוד" או "בין השאר", כדי שרשימה חלקית לא תיקרא כרשימה מלאה.
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
/* המנוע: לולאת הכלים מול Claude. מוחזר cacheable=false כשלא נוצרה תשובה
   אמיתית - כדי שהודעת כישלון לא תיתקע במטמון ותוגש לכל מי שישאל אחריה. */
async function runAgent(client, question) {
  const messages = [{ role: 'user', content: question }];
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const fetched = [];

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
      return { text: 'לא הצלחתי לענות על השאלה הזו.', cacheable: false, usage, fetched };
    }

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (!toolUses.length) {
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      const truncated = response.stop_reason === 'max_tokens';
      return {
        text: text || 'לא הצלחתי לנסח תשובה.',
        // תשובה קטועה היא תשובה גרועה, ואין טעם להקפיא אותה לחודש
        cacheable: Boolean(text) && !truncated,
        truncated,
        usage,
        fetched,
      };
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
  return { text: 'השאלה הסתבכה יותר מדי. נסו לנסח אותה בצורה ממוקדת יותר.', cacheable: false, usage, fetched };
}

const NO_USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST בלבד' });
  }

  // מתג ההרג. ברירת המחדל היא דלוק בכוונה: משתנה סביבה שנמחק בטעות
  // אמור להשאיר את האתר עובד, לא לכבות אותו.
  if (process.env.ASK_ENABLED === '0') {
    return res.status(503).json({ error: 'הסוכן כבוי כרגע. נסו שוב מאוחר יותר.' });
  }

  const adminToken = process.env.ADMIN_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!adminToken || !apiKey) {
    return res.status(500).json({ error: 'השרת לא הוגדר: חסר ANTHROPIC_API_KEY או ADMIN_TOKEN' });
  }

  const isAdmin = (req.headers['x-admin-token'] || '') === adminToken;
  // הדלת לציבור נפתחת רק כש-ASK_PUBLIC=1. עד אז הקוד המלא רץ, אבל
  // רק המנהל מגיע אליו - כך אפשר לבנות ולבדוק בלי לחשוף.
  if (!isAdmin && process.env.ASK_PUBLIC !== '1') {
    return res.status(403).json({ error: 'הסוכן פתוח כרגע למנהל בלבד' });
  }

  let question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question) return res.status(400).json({ error: 'לא נשלחה שאלה' });
  if (question.length > MAX_QUESTION_CHARS) {
    return res.status(400).json({ error: `השאלה ארוכה מדי (${question.length} תווים, המקסימום ${MAX_QUESTION_CHARS})` });
  }
  // סימון הקישורים [[kind:id|שם]] הוא שפה בין המודל לממשק. אילו גולש
  // היה יכול לכתוב אותו בשאלה, הוא היה יכול לשתול בתשובה קישור מזויף.
  question = question.replace(/\[\[|\]\]/g, ' ').trim();

  const ready = dbReady();
  const ipHash = ready ? ipHashOf(req) : null;
  const qhash = ready ? qhashOf(question) : null;
  let remaining = null;

  /* המנהל עוקף את המטמון ואת המכסה בכוונה: בלי זה אי אפשר לבדוק שוב
     ושוב את אותה שאלה, וזו כל מטרת מסך הבדיקה. */
  if (!isAdmin) {
    if (!ready) {
      return res.status(503).json({ error: 'שכבת ההגבלה אינה מוגדרת בשרת' });
    }
    const gate = await askGate({
      ipHash, qhash,
      maxDay: MAX_PER_DAY,
      budgetCents: DAILY_BUDGET_CENTS,
      cacheDays: CACHE_DAYS,
    });
    // נכשלת הבדיקה - נועלים. שער שנפתח כשהוא שבור אינו שער.
    if (!gate) return res.status(503).json({ error: 'שירות השאלות אינו זמין כרגע' });

    if (gate.cached) {
      // נרשם כדי שנדע מה שיעור הפגיעה במטמון. answer נשאר null
      // כדי שהשורה הזו לא תיספר כתשובה נוספת בשליפה הבאה.
      await logAsk({ qhash, question, answer: null, costCents: 0, servedFrom: 'cache', ipHash });
      return res.status(200).json({
        answer: gate.cached, cached: true, costCents: 0, usage: NO_USAGE, fetched: [],
      });
    }
    if (!gate.allow) {
      return res.status(429).json({
        reason: gate.reason,
        error: gate.reason === 'budget'
          ? 'תקציב השאלות היומי של האתר נוצל. נסו שוב מחר - החיפוש הרגיל זמין תמיד, ללא הגבלה.'
          : `הגעתם למכסת השאלות היומית (${MAX_PER_DAY} שאלות). החיפוש הרגיל זמין תמיד, ללא הגבלה.`,
      });
    }
    remaining = typeof gate.remaining === 'number' ? gate.remaining : null;
  }

  try {
    const out = await runAgent(new Anthropic({ apiKey }), question);
    const costCents = costOf(out.usage);
    if (ready) {
      await logAsk({
        qhash, question,
        answer: out.cacheable ? out.text : null,
        costCents,
        servedFrom: isAdmin ? 'admin' : 'model',
        ipHash,
      });
    }
    return res.status(200).json({
      answer: out.text,
      truncated: out.truncated,
      usage: out.usage,
      fetched: out.fetched,
      costCents,
      remaining,
    });
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
