/* תיבת "הערה למנהל" של ציר הזמן, מורכבת לתוך המסכים שאינם React
   (מסע הדורות ומפת הארץ). אותו רכיב ואותה טבלה ב-Supabase - כדי שלא
   ייווצרו שלושה מסלולי שליחה שונים שצריך לתקן כל אחד בנפרד. */
import { createRoot } from 'react-dom/client';
import NotesBox from '../components/NotesBox.jsx';

let root = null;

function draw(open) {
  const host = document.querySelector('#notesHost');
  if (!host) return;
  if (!root) root = createRoot(host);
  root.render(<NotesBox open={open} onClose={() => draw(false)} />);
}

export const openNotes = () => draw(true);
