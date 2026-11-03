import { X } from 'lucide-react';
import { fontStyle } from '../lib/fonts';
import type { Snippet } from '../types';

interface Props {
  snippets: Snippet[];
  disabled: boolean;
  onInsert: (s: Snippet) => void;
  onRemove: (id: string) => void;
}

export function SnippetsPanel({ snippets, disabled, onInsert, onRemove }: Props) {
  return (
    <section className="panel">
      <div className="panel-title">Snippets</div>
      {snippets.length === 0 && <p className="hint">Select a text element and press the stamp button to save it here.</p>}
      <ul className="snippets">
        {snippets.map((s) => (
          <li key={s.id}>
            <button className="snippet" disabled={disabled} title="Insert on the current page" onClick={() => onInsert(s)}>
              <span
                style={{ ...fontStyle(s.font, s.bold, s.italic), color: s.color }}
              >
                {s.text}
              </span>
            </button>
            <button className="snippet-remove" title="Remove snippet" onClick={() => onRemove(s.id)}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
