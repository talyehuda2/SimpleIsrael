import { Component } from 'react';

/* גבול שגיאה סביב רכיב שנטען בעצלתיים (lazy).

   Suspense מטפל בהמתנה, לא בכישלון. כשה-import נדחה, React זורק בזמן
   רינדור - ובלי גבול שגיאה הוא מנתק את **כל העץ**, כלומר הכרטיס כולו
   נעלם והפאנל נשאר לבן.

   וזה לא תרחיש נדיר: שמות הצ'אנקים מכילים גיבוב תוכן, ולכן כל פריסה
   משנה אותם. גולש שהדף שלו נטען לפני הפריסה ולוחץ "תגובות" אחריה מבקש
   קובץ שכבר לא קיים בשרת ומקבל 404. בלי הגבול הזה, כל עדכון של האתר
   שובר את הכרטיס לכל מי שנמצא בו באותו רגע. */
export default class ChunkBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err) {
    console.error('lazy chunk failed to load', err);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="chunk-err">
        <p>לא הצלחנו לטעון את החלק הזה. ייתכן שהאתר עודכן בזמן שהדף היה פתוח.</p>
        <button className="chunk-reload" type="button" onClick={() => window.location.reload()}>
          רענון הדף
        </button>
      </div>
    );
  }
}
