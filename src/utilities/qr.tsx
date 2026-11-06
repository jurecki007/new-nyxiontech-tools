import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';
import { ColorField, NumberField } from '../components/fields';
import { downloadBlob } from '../lib/zip';
import { Option, Segmented, ToolPage } from './ui';
import type { Utility } from './types';
import { useT, type Messages } from '../i18n';

type Kind = 'url' | 'text' | 'wifi' | 'contact' | 'email';
type Level = 'L' | 'M' | 'Q' | 'H';

/** Escapes characters that are special in the Wi-Fi and MeCard formats. */
const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');

function payload(kind: Kind, f: Record<string, string>): string {
  switch (kind) {
    case 'url':
      return f.url?.trim() ?? '';
    case 'text':
      return f.text ?? '';
    case 'wifi':
      return f.ssid ? `WIFI:T:${f.security || 'WPA'};S:${esc(f.ssid)};P:${esc(f.password ?? '')};${f.hidden === 'yes' ? 'H:true;' : ''};` : '';
    case 'email':
      return f.to ? `mailto:${f.to}?subject=${encodeURIComponent(f.subject ?? '')}&body=${encodeURIComponent(f.body ?? '')}` : '';
    case 'contact':
      if (!f.name) return '';
      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${f.name}`,
        f.org && `ORG:${f.org}`,
        f.phone && `TEL:${f.phone}`,
        f.email && `EMAIL:${f.email}`,
        f.website && `URL:${f.website}`,
        'END:VCARD',
      ]
        .filter(Boolean)
        .join('\n');
  }
}

type FieldKey = keyof Messages['qr']['fields'];

/** The form for each kind of code. Field names are in the dictionaries (src/i18n, `qr.fields`). */
const FIELDS: Record<Kind, { key: FieldKey; type?: string; options?: string[] }[]> = {
  url: [{ key: 'url' }],
  text: [{ key: 'text', type: 'textarea' }],
  wifi: [{ key: 'ssid' }, { key: 'password' }, { key: 'security', options: ['WPA', 'WEP', 'nopass'] }, { key: 'hidden', options: ['no', 'yes'] }],
  email: [{ key: 'to' }, { key: 'subject' }, { key: 'body', type: 'textarea' }],
  contact: [{ key: 'name' }, { key: 'org' }, { key: 'phone' }, { key: 'email' }, { key: 'website' }],
};

export const qrUtility: Utility = {
  id: 'qr',
  icon: QrCode,
  group: 'other',
  Component: function Qr() {
    const [kind, setKind] = useState<Kind>('url');
    const [fields, setFields] = useState<Record<string, string>>({ url: 'https://nyxiontech.com', security: 'WPA', hidden: 'no' });
    const [fg, setFg] = useState('#000000');
    const [bg, setBg] = useState('#ffffff');
    const [size, setSize] = useState(512);
    const [margin, setMargin] = useState(2);
    const [level, setLevel] = useState<Level>('M');
    const [svg, setSvg] = useState('');
    const [error, setError] = useState<string | null>(null);
    const t = useT().qr;
    const optionLabel = (o: string) => (o === 'nopass' ? t.noPassword : o === 'no' ? t.no : o === 'yes' ? t.yes : o);

    const data = useMemo(() => payload(kind, fields), [kind, fields]);
    const opts = { errorCorrectionLevel: level, margin, color: { dark: fg, light: bg } };

    useEffect(() => {
      if (!data) {
        setSvg('');
        return;
      }
      QRCode.toString(data, { ...opts, type: 'svg' }).then(
        (s) => {
          setSvg(s);
          setError(null);
        },
        (e: Error) => setError(e.message),
      );
      // `opts` is rebuilt from level, margin, fg and bg, which are the real dependencies.
    }, [data, level, margin, fg, bg]);

    const downloadPng = async () => {
      const url = await QRCode.toDataURL(data, { ...opts, width: size });
      downloadBlob(await (await fetch(url)).blob(), 'qr-code.png');
    };

    return (
      <ToolPage utility={qrUtility}>
        <div className="qr-layout">
          <div className="qr-form">
            <Option label={t.type}>
              <Segmented<Kind>
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'url', label: t.kinds.url },
                  { value: 'wifi', label: t.kinds.wifi },
                  { value: 'contact', label: t.kinds.contact },
                  { value: 'email', label: t.kinds.email },
                  { value: 'text', label: t.kinds.text },
                ]}
              />
            </Option>
            {FIELDS[kind].map((f) => (
              <Option key={f.key} label={t.fields[f.key]}>
                {f.options ? (
                  <Segmented<string> value={fields[f.key] ?? f.options[0]} onChange={(v) => setFields({ ...fields, [f.key]: v })} options={f.options.map((o) => ({ value: o, label: optionLabel(o) }))} />
                ) : f.type === 'textarea' ? (
                  <textarea className="text-field" rows={3} value={fields[f.key] ?? ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
                ) : (
                  <input className="text-field" value={fields[f.key] ?? ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
                )}
              </Option>
            ))}
            <Option label={t.style}>
              <div className="option-row">
                <ColorField label={t.code} value={fg} onChange={setFg} />
                <ColorField label={t.background} value={bg} onChange={setBg} />
                <NumberField label={t.quietZone} value={margin} min={0} onChange={(n) => setMargin(Math.round(n))} />
              </div>
            </Option>
            <Option label={t.errorCorrection} hint={t.errorCorrectionHint}>
              <Segmented<Level>
                value={level}
                onChange={setLevel}
                options={[
                  { value: 'L', label: t.low },
                  { value: 'M', label: t.medium },
                  { value: 'Q', label: t.high },
                  { value: 'H', label: t.max },
                ]}
              />
            </Option>
          </div>
          <div className="qr-preview">
            {svg ? <div className="qr-image" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="qr-image empty">{t.empty}</div>}
            {error && <p className="error-text">{error}</p>}
            <div className="option-row">
              <NumberField label={t.pngSize} value={size} min={64} step={64} onChange={(n) => setSize(Math.round(n))} />
            </div>
            <div className="row">
              <button className="btn primary" disabled={!svg} onClick={() => void downloadPng()}>
                {t.downloadPng}
              </button>
              <button className="btn ghost" disabled={!svg} onClick={() => downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr-code.svg')}>
                {t.downloadSvg}
              </button>
            </div>
            <p className="hint">{t.svgHint}</p>
          </div>
        </div>
      </ToolPage>
    );
  },
};
