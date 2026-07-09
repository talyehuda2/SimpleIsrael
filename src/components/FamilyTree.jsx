import { genealogy } from '../data/genealogy.js';

function Node({ node, heir, onJump }) {
  const clickable = !!node.id;
  return (
    <button
      className={`tree-node${heir ? ' heir' : ' sibling'}${clickable ? ' clickable' : ''}`}
      onClick={() => clickable && onJump(node.id)}
      disabled={!clickable}
      title={clickable ? 'קפיצה לציר הזמן' : undefined}
    >
      <span className="tn-name">{node.name}</span>
      {node.role && <span className="tn-role">{node.role}</span>}
      {node.note && <span className="tn-note">{node.note}</span>}
    </button>
  );
}

export default function FamilyTree({ open, onClose, onJump }) {
  if (!open) return null;
  const jump = (id) => { onJump(id); onClose(); };
  return (
    <div className="tree-overlay" onClick={onClose}>
      <div className="tree-panel" onClick={(e) => e.stopPropagation()}>
        <button className="tree-close" onClick={onClose} aria-label="סגירה">✕</button>
        <h2 className="tree-title">👑 אילן היוחסין של בית דוד</h2>
        <p className="tree-sub">מאברהם אבינו עד מלכי יהודה האחרונים · לחיצה על דמות מודגשת מקפיצה אליה בציר</p>
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
