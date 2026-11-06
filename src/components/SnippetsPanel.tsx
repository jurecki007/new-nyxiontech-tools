import { X } from 'lucide-react';
import { fontStyle } from '../lib/fonts';
import type { Snippet } from '../types';
import { useT } from '../i18n';

interface Props {
  snippets: Snippet[];
  disabled: boolean;
  onInsert: (s: Snippet) => void;
  onRemove: (id: string) => void;
}

export function SnippetsPanel({ snippets, disabled, onInsert, onRemove }: Props) {
  const t = useT();
  return (
    <section className="panel">
      <div className="panel-title">{t.editor.snippets}</div>
      {snippets.length === 0 && <p className="hint">{t.editor.snippetsHint}</p>}
      <ul className="snippets">
        {snippets.map((s) => (
          <li key={s.id}>
            <button className="snippet" disabled={disabled} title={t.editor.insertSnippet} onClick={() => onInsert(s)}>
              <span
                style={{ ...fontStyle(s.font, s.bold, s.italic), color: s.color }}
              >
                {s.text}
              </span>
            </button>
            <button className="snippet-remove" title={t.editor.removeSnippet} onClick={() => onRemove(s.id)}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
