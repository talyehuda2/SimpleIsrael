const FEATURES = [
  { icon: '🔍', title: 'חיפוש וקפיצה', text: 'הקלידו שם של דמות או אירוע — והציר יקפוץ אליו.' },
  { icon: '👥', title: 'בני-הזמן', text: 'בכל כרטיס יש כפתור שמדגיש את כל מי שחי באותה תקופה.' },
  { icon: '👑', title: 'אילן יוחסין', text: 'השושלת מאברהם ואילך. לחיצה על שם קופצת אליו בציר.' },
  { icon: '📍', title: 'מפת המסע', text: 'לדמויות נבחרות — מסע מודרך על מפת הארץ, תחנה אחר תחנה.' },
  { icon: '💬', title: 'תגובות', text: 'אפשר להוסיף הערה, מקור או תיקון לכל אירוע ודמות.' },
  { icon: '↔️', title: 'ניווט', text: 'הזמן זורם מימין (עבר) לשמאל · זום ב-Ctrl+גלגלת או צביטה · לחיצה על שם שכבה מקטינה אותה.' },
];

export default function Intro({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="intro-overlay" onClick={onClose}>
      <div className="intro-card" onClick={(e) => e.stopPropagation()}>
        <button className="about-close" onClick={onClose} aria-label="סגירה">✕</button>
        <h3 className="intro-title">ברוכים הבאים 📖</h3>
        <p className="intro-sub">ציר הזמן של עם ישראל — מהאבות ועד חורבן בית שני. הנה מה שאפשר לעשות כאן:</p>
        <ul className="intro-list">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="intro-icon" aria-hidden="true">{f.icon}</span>
              <div className="intro-text">
                <b>{f.title}</b>
                <span>{f.text}</span>
              </div>
            </li>
          ))}
        </ul>
        <button className="intro-cta" onClick={onClose}>יאללה, מתחילים</button>
      </div>
    </div>
  );
}
