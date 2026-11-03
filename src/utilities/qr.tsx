import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';
import { ColorField, NumberField } from '../components/fields';
import { downloadBlob } from '../lib/zip';
import { Option, Segmented, ToolPage } from './ui';
import type { Utility } from './types';

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

const FIELDS: Record<Kind, { key: string; label: string; type?: string; options?: string[] }[]> = {
  url: [{ key: 'url', label: 'Link' }],
  text: [{ key: 'text', label: 'Text', type: 'textarea' }],
  wifi: [
    { key: 'ssid', label: 'Network name' },
    { key: 'password', label: 'Password' },
    { key: 'security', label: 'Security', options: ['WPA', 'WEP', 'nopass'] },
    { key: 'hidden', label: 'Hidden network', options: ['no', 'yes'] },
  ],
  email: [
    { key: 'to', label: 'To' },
    { key: 'subject', label: 'Subject' },
    { key: 'body', label: 'Message', type: 'textarea' },
  ],
  contact: [
    { key: 'name', label: 'Full name' },
    { key: 'org', label: 'Company' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'E-mail' },
    { key: 'website', label: 'Website' },
  ],
};

export const qrUtility: Utility = {
  id: 'qr',
  label: 'QR code generator',
  description: 'Make QR codes for links, Wi-Fi, contact cards, e-mails or text. No tracking, no expiry.',
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
            <Option label="Type">
              <Segmented<Kind>
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'url', label: 'Link' },
                  { value: 'wifi', label: 'Wi-Fi' },
                  { value: 'contact', label: 'Contact' },
                  { value: 'email', label: 'E-mail' },
                  { value: 'text', label: 'Text' },
                ]}
              />
            </Option>
            {FIELDS[kind].map((f) => (
              <Option key={f.key} label={f.label}>
                {f.options ? (
                  <Segmented<string> value={fields[f.key] ?? f.options[0]} onChange={(v) => setFields({ ...fields, [f.key]: v })} options={f.options.map((o) => ({ value: o, label: o === 'nopass' ? 'none' : o }))} />
                ) : f.type === 'textarea' ? (
                  <textarea className="text-field" rows={3} value={fields[f.key] ?? ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
                ) : (
                  <input className="text-field" value={fields[f.key] ?? ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
                )}
              </Option>
            ))}
            <Option label="Style">
              <div className="option-row">
                <ColorField label="Code" value={fg} onChange={setFg} />
                <ColorField label="Background" value={bg} onChange={setBg} />
                <NumberField label="Quiet zone" value={margin} min={0} onChange={(n) => setMargin(Math.round(n))} />
              </div>
            </Option>
            <Option label="Error correction" hint="Higher levels still scan when part of the code is damaged or covered by a logo, but make it denser.">
              <Segmented<Level>
                value={level}
                onChange={setLevel}
                options={[
                  { value: 'L', label: 'Low' },
                  { value: 'M', label: 'Medium' },
                  { value: 'Q', label: 'High' },
                  { value: 'H', label: 'Max' },
                ]}
              />
            </Option>
          </div>
          <div className="qr-preview">
            {svg ? <div className="qr-image" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="qr-image empty">Fill in the form</div>}
            {error && <p className="error-text">{error}</p>}
            <div className="option-row">
              <NumberField label="PNG size (px)" value={size} min={64} step={64} onChange={(n) => setSize(Math.round(n))} />
            </div>
            <div className="row">
              <button className="btn primary" disabled={!svg} onClick={() => void downloadPng()}>
                Download PNG
              </button>
              <button className="btn ghost" disabled={!svg} onClick={() => downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr-code.svg')}>
                Download SVG
              </button>
            </div>
            <p className="hint">SVG scales to any size without blur, which is best for print.</p>
          </div>
        </div>
      </ToolPage>
    );
  },
};
