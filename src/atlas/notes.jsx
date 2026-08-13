/* תיבת "הערה למנהל" של ציר הזמן, מורכבת לתוך מסע הדורות. אותו רכיב
   ואותה טבלה ב-Supabase - כדי שלא ייווצרו שני מסלולי שליחה שונים. */
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
