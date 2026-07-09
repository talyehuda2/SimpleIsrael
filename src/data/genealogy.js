// אילן היוחסין של בית דוד — מאברהם אבינו עד מלכי יהודה האחרונים.
// כל איבר במערך הוא "דור": main = הדמות הממשיכה את קו המלוכה;
// siblings = אחים/אחיות באותו דור שאינם ממשיכים את הקו (מוצגים מעומעמים).
// שדה id קיים רק היכן שהדמות מופיעה בציר הזמן — ומאפשר קפיצה אליה.
// המקורות לשלשלת: בראשית, רות ד', דברי הימים א' ב'–ג', מלכים.

export const genealogy = [
  { main: { id: 'avraham', name: 'אברהם', role: 'האב הראשון', note: 'שרה' } },
  { main: { id: 'yitzchak', name: 'יצחק', note: 'רבקה' }, siblings: [{ name: 'ישמעאל' }] },
  { main: { id: 'yaakov', name: 'יעקב', note: 'רחל ולאה' }, siblings: [{ name: 'עשו' }] },
  {
    main: { name: 'יהודה', role: 'שבט המלוכה' },
    siblingsLabel: 'שנים עשר שבטי ישראל',
    siblings: [
      { name: 'ראובן' }, { name: 'שמעון' }, { name: 'לוי' }, { name: 'דן' },
      { name: 'נפתלי' }, { name: 'גד' }, { name: 'אשר' }, { name: 'יששכר' },
      { name: 'זבולן' }, { id: 'yosef', name: 'יוסף' }, { name: 'בנימין' },
    ],
  },
  { main: { name: 'פרץ' }, siblings: [{ name: 'זרח' }] },
  { main: { name: 'חצרון' } },
  { main: { name: 'רם' } },
  { main: { name: 'עמינדב' } },
  { main: { name: 'נחשון', note: 'נשיא שבט יהודה במדבר' } },
  { main: { name: 'שלמון (שלמא)', note: 'רחב' } },
  { main: { name: 'בועז', note: 'רות המואבייה' } },
  { main: { name: 'עובד' } },
  { main: { name: 'ישי' } },
  { main: { id: 'david', name: 'דוד', role: 'מלך ישראל' } },
  { main: { id: 'shlomo', name: 'שלמה', role: 'מלך ישראל' } },
  { main: { id: 'rechavam', name: 'רחבעם', role: 'מלך יהודה', note: 'בימיו התפלגה הממלכה' } },
  { main: { id: 'aviyam', name: 'אבים (אביה)', role: 'מלך יהודה' } },
  { main: { id: 'asa', name: 'אסא', role: 'מלך יהודה' } },
  { main: { id: 'yehoshafat', name: 'יהושפט', role: 'מלך יהודה' } },
  { main: { id: 'yehoram-j', name: 'יהורם', role: 'מלך יהודה', note: 'נשא את עתליה בת אחאב' } },
  { main: { id: 'achazyahu-j', name: 'אחזיהו', role: 'מלך יהודה' } },
  { main: { id: 'yoash-j', name: 'יואש', role: 'מלך יהודה', note: 'הוסתר מעתליה שמלכה בֵּינתיים' } },
  { main: { id: 'amatzya', name: 'אמציה', role: 'מלך יהודה' } },
  { main: { id: 'uziyahu', name: 'עוזיהו (עזריה)', role: 'מלך יהודה' } },
  { main: { id: 'yotam', name: 'יותם', role: 'מלך יהודה' } },
  { main: { id: 'achaz', name: 'אחז', role: 'מלך יהודה' } },
  { main: { id: 'chizkiyahu', name: 'חזקיהו', role: 'מלך יהודה' } },
  { main: { id: 'menashe', name: 'מנשה', role: 'מלך יהודה' } },
  { main: { id: 'amon', name: 'אמון', role: 'מלך יהודה' } },
  { main: { id: 'yoshiyahu', name: 'יאשיהו', role: 'מלך יהודה' } },
  {
    main: { id: 'yehoyakim', name: 'יהויקים', role: 'מלך יהודה' },
    siblingsLabel: 'בני יאשיהו',
    siblings: [
      { id: 'yehoachaz-j', name: 'יהואחז' },
      { id: 'tzidkiyahu', name: 'צדקיהו', note: 'המלך האחרון' },
    ],
  },
  { main: { id: 'yehoyachin', name: 'יהויכין', role: 'מלך יהודה', note: 'גלה לבבל' } },
];
