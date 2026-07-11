import { genealogy } from '../data/genealogy.js';

// אייקון "ציר זמן" — קו אופקי עם סמן, מסמן דמות שמקושרת לציר וניתן לקפוץ אליה
function TimelineMark() {
  return (
    <svg className="tn-link" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <rect x="2" y="11" width="20" height="2" rx="1" fill="currentColor" />
      <circle cx="12" cy="12" r="3.6" fill="currentColor" />
    </svg>
  );
}

function Node({ node, heir, onJump }) {
  const clickable = !!node.id;
  return (
    <button
      className={`tree-node${heir ? ' heir' : ' sibling'}${clickable ? ' clickable' : ''}`}
      onClick={() => clickable && onJump(node.id)}
      disabled={!clickable}
      title={clickable ? 'קפיצה לציר הזמן' : undefined}
    >
      <span className="tn-name">{node.name}{clickable && <TimelineMark />}</span>
      {node.role && <span className="tn-role">{node.role}</span>}
      {node.note && <span className="tn-note">{node.note}</span>}
    </button>
  );
}

export default function FamilyTree({ open, onClose, onJump }) {
  if (!open) return null;
  // onJump כבר סוגר את האילן בעצמו (סגירה ישירה, לא דרך "אחורה") — לכן לא קוראים כאן ל-onClose
  const jump = (id) => onJump(id);
  return (
    <div className="tree-overlay" onClick={onClose}>
      <div className="tree-panel" onClick={(e) => e.stopPropagation()}>
        <button className="tree-close" onClick={onClose} aria-label="סגירה">✕</button>
        <h2 className="tree-title">👑 אילן היוחסין של בית דוד</h2>
        <p className="tree-sub">
          מאברהם אבינו עד מלכי יהודה האחרונים · דמות המסומנת ב־<TimelineMark /> מקושרת לציר, ולחיצה קופצת אליה
        </p>
        <div className="tree-flow">
          {genealogy.map((g, i) => (
            <div className="tree-gen" key={i}>
              {i > 0 && <div className="tree-connector" />}
              {g.siblings ? (
                <div className="tree-branch">
                  {g.siblingsLabel && <div className="tree-sib-label">{g.siblingsLabel}</div>}
                  <div className="tree-siblings">
                    {g.siblings.map((s, j) => <Node key={j} node={s} onJump={jump} />)}
                  </div>
                  <div className="tree-connector" />
                  <Node node={g.main} heir onJump={jump} />
                </div>
              ) : (
                <Node node={g.main} heir onJump={jump} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
