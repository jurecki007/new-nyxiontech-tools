import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Bold, Check, ChevronDown, Italic } from 'lucide-react';
import { FONT_CATEGORIES, FONTS, fontStyle, getFont, hasFace, loadFontPreviews, loadFonts } from '../lib/fonts';
import type { FontId, TextStyle } from '../types';
import { useT } from '../i18n';

const round = (n: number) => Math.round(n * 10) / 10;

export function NumberField({
  label,
  value,
  onChange,
  onFocus,
  min,
  step = 1,
  className = '',
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  onFocus?: () => void;
  min?: number;
  step?: number;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <input
        type="number"
        value={round(value)}
        min={min}
        step={step}
        onFocus={onFocus}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(min !== undefined ? Math.max(min, n) : n);
        }}
      />
    </label>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (c: string) => void;
  onFocus?: () => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="color" value={value} onFocus={onFocus} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Toggle({
  on,
  disabled,
  title,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className={`toggle${on ? ' on' : ''}`} title={title} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

/** Dropdown listing every bundled font, each previewed in its own typeface. */
export function FontPicker({ value, onChange }: { value: FontId; onChange: (id: FontId) => void }) {
  // Fixed positioning lets the menu escape scrolling sidebars; null means closed.
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const open = menuStyle !== null;
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  const close = () => setMenuStyle(null);
  const toggle = () => {
    if (open || !ref.current) return close();
    const r = ref.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const width = Math.max(r.width, 250);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    setMenuStyle(
      below >= 280 || below >= above
        ? { left, width, top: r.bottom + 4, maxHeight: Math.min(380, below) }
        : { left, width, bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(380, above) },
    );
  };
  const font = getFont(value);

  useEffect(() => {
    void loadFonts([value]).then(rerender);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    void loadFontPreviews().then(rerender);
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenuStyle(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuStyle(null);
    // The menu is fixed-positioned, so close it rather than let it drift on scroll/resize.
    const dismiss = () => setMenuStyle(null);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  return (
    <div className="font-picker" ref={ref}>
      <button className="font-picker-button" onClick={toggle} aria-expanded={open}>
        <span style={fontStyle(value, false, false)}>{font.label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="font-menu" role="listbox" style={menuStyle}>
          {FONT_CATEGORIES.map((c) => (
            <div key={c.id}>
              <div className="font-menu-group">{t.editor.fontCategories[c.id]}</div>
              {FONTS.filter((f) => f.category === c.id).map((f) => (
                <button
                  key={f.id}
                  role="option"
                  aria-selected={f.id === value}
                  className={`font-option${f.id === value ? ' on' : ''}`}
                  onClick={() => {
                    onChange(f.id);
                    close();
                  }}
                >
                  <span style={fontStyle(f.id, false, false)}>{f.label}</span>
                  {f.note && <small>{t.editor.fontNotes[f.note] ?? f.note}</small>}
                  {f.id === value && <Check size={14} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Font, size, colour and bold/italic. `discrete` is true for one-shot changes
 * (buttons, font choice) and false for continuous ones (typing, colour dragging).
 */
export function TextStyleFields({
  value,
  onChange,
  onBeginEdit,
}: {
  value: TextStyle;
  onChange: (patch: Partial<TextStyle>, discrete: boolean) => void;
  onBeginEdit?: () => void;
}) {
  const canBold = hasFace(value.font, true, false);
  const canItalic = hasFace(value.font, false, true);
  const t = useT();
  return (
    <>
      <FontPicker
        value={value.font}
        onChange={(font) =>
          onChange({ font, bold: value.bold && hasFace(font, true, false), italic: value.italic && hasFace(font, false, true) }, true)
        }
      />
      <div className="row nowrap">
        <NumberField label={t.editor.size} className="size-field" value={value.size} min={2} step={0.5} onFocus={onBeginEdit} onChange={(size) => onChange({ size }, false)} />
        <ColorField label={t.editor.color} value={value.color} onFocus={onBeginEdit} onChange={(color) => onChange({ color }, false)} />
        <div className="field toggles">
          <span>{t.editor.style}</span>
          <div className="row nowrap tight">
            <Toggle on={value.bold} disabled={!canBold} title={canBold ? t.editor.bold : t.editor.noBold} onClick={() => onChange({ bold: !value.bold }, true)}>
              <Bold size={15} />
            </Toggle>
            <Toggle
              on={value.italic}
              disabled={!canItalic}
              title={canItalic ? t.editor.italic : t.editor.noItalic}
              onClick={() => onChange({ italic: !value.italic }, true)}
            >
              <Italic size={15} />
            </Toggle>
          </div>
        </div>
      </div>
    </>
  );
}
