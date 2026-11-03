import { useEffect, useRef, useState } from 'react';
import { Signature, X } from 'lucide-react';
import { uid } from '../lib/doc';
import { fontStyle, loadFonts } from '../lib/fonts';
import { pickFiles } from '../lib/files';
import { decodeImage } from '../lib/images';
import { loadUiPref, saveUiPref } from '../lib/storage';
import type { ActionTool } from './types';

type Mode = 'draw' | 'type' | 'upload';

const SCRIPT_FONTS = ['dancing-script', 'great-vibes', 'caveat'];
const INK = ['#1a1a1a', '#1f3fae', '#0b5d1e'];

/** Crops a canvas to its non-transparent pixels and returns a PNG data URL. */
function trimmedPng(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 6;
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1 + pad * 2;
  out.height = maxY - minY + 1 + pad * 2;
  out.getContext('2d')!.drawImage(canvas, minX, minY, out.width - pad * 2, out.height - pad * 2, pad, pad, out.width - pad * 2, out.height - pad * 2);
  return out.toDataURL('image/png');
}

function DrawPad({ ink, canvasRef }: { ink: string; canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    c.getContext('2d')!.scale(dpr, dpr);
  }, [canvasRef]);

  const point = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure || 0.5 };
  };

  return (
    <canvas
      ref={canvasRef}
      className="sig-pad"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = point(e);
      }}
      onPointerMove={(e) => {
        if (!last.current) return;
        const p = point(e);
        const ctx = canvasRef.current!.getContext('2d')!;
        ctx.strokeStyle = ink;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Faster strokes get thinner, like a pen.
        const speed = Math.hypot(p.x - last.current.x, p.y - last.current.y);
        ctx.lineWidth = Math.max(1.2, 3.2 - speed * 0.08);
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last.current = p;
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  );
}

function SignatureDialog({ onDone, onCancel }: { onDone: (png: string) => void; onCancel: () => void }) {
  const saved = loadUiPref<string | null>('last-signature', null);
  const [mode, setMode] = useState<Mode>('draw');
  const [ink, setInk] = useState(INK[0]);
  const [name, setName] = useState('');
  const [font, setFont] = useState(SCRIPT_FONTS[0]);
  const [upload, setUpload] = useState<string | null>(null);
  const [removeWhite, setRemoveWhite] = useState(true);
  const [, setFontsReady] = useState(false);
  const padRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    void loadFonts(SCRIPT_FONTS).then(() => setFontsReady(true));
  }, []);

  const finish = (png: string | null) => {
    if (!png) return;
    saveUiPref('last-signature', png);
    onDone(png);
  };

  const fromTyped = () => {
    const c = document.createElement('canvas');
    const size = 96;
    const ctx = c.getContext('2d')!;
    const style = fontStyle(font, false, false);
    const css = `${style.fontStyle} ${style.fontWeight} ${size}px "${style.fontFamily}"`;
    ctx.font = css;
    c.width = Math.ceil(ctx.measureText(name).width + size);
    c.height = size * 2;
    ctx.font = css;
    ctx.fillStyle = ink;
    ctx.textBaseline = 'middle';
    ctx.fillText(name, size / 2, size);
    return trimmedPng(c);
  };

  const fromUpload = async (file: File) => {
    const bitmap = await decodeImage(file);
    const c = document.createElement('canvas');
    const scale = Math.min(1, 1200 / bitmap.width);
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    bitmap.close();
    if (removeWhite) {
      // Scanned signatures: make paper-coloured pixels transparent.
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const lightness = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (lightness > 200) d[i + 3] = 0;
        else if (lightness > 150) d[i + 3] = Math.round(((200 - lightness) / 50) * d[i + 3]);
      }
      ctx.putImageData(img, 0, 0);
    }
    setUpload(trimmedPng(c));
  };

  return (
    <div className="modal" role="dialog" aria-label="Add signature">
      <header className="modal-head">
        <b>Add signature</b>
        <button className="icon-btn" title="Close" onClick={onCancel}>
          <X size={18} />
        </button>
      </header>
      <div className="segmented">
        {(['draw', 'type', 'upload'] as const).map((m) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
            {m === 'draw' ? 'Draw' : m === 'type' ? 'Type' : 'Upload image'}
          </button>
        ))}
      </div>

      {mode !== 'upload' && (
        <div className="row">
          <span className="muted">Ink</span>
          {INK.map((c) => (
            <button key={c} className={`swatch${c === ink ? ' on' : ''}`} style={{ background: c }} title={c} onClick={() => setInk(c)} />
          ))}
        </div>
      )}

      {mode === 'draw' && (
        <>
          <DrawPad ink={ink} canvasRef={padRef} />
          <div className="row">
            <button
              className="btn ghost"
              onClick={() => {
                const c = padRef.current!;
                c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
              }}
            >
              Clear
            </button>
            <span className="muted">Sign with your mouse, touchpad or finger.</span>
          </div>
        </>
      )}

      {mode === 'type' && (
        <>
          <input className="text-field" placeholder="Your name" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          <div className="sig-fonts">
            {SCRIPT_FONTS.map((f) => (
              <button key={f} className={f === font ? 'on' : ''} style={{ ...fontStyle(f, false, false), color: ink }} onClick={() => setFont(f)}>
                {name || 'Jan Kowalski'}
              </button>
            ))}
          </div>
        </>
      )}

      {mode === 'upload' && (
        <>
          <div className="row">
            <button className="btn ghost" onClick={() => void pickFiles('image/*,.heic', false).then(([f]) => f && fromUpload(f))}>
              Choose image…
            </button>
            <label className="check">
              <input type="checkbox" checked={removeWhite} onChange={(e) => setRemoveWhite(e.target.checked)} />
              Remove white background (applies to the next image)
            </label>
          </div>
          <div className="sig-preview">{upload ? <img src={upload} alt="Uploaded signature" /> : <span className="muted">A photo or scan of your signature on white paper works best.</span>}</div>
        </>
      )}

      <footer className="modal-foot">
        {saved && (
          <button className="btn ghost" title="Use the signature from last time" onClick={() => finish(saved)}>
            <img src={saved} alt="" className="sig-thumb" /> Use last
          </button>
        )}
        <span className="spacer" />
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={(mode === 'type' && !name.trim()) || (mode === 'upload' && !upload)}
          onClick={() => finish(mode === 'draw' ? trimmedPng(padRef.current!) : mode === 'type' ? fromTyped() : upload)}
        >
          Insert signature
        </button>
      </footer>
    </div>
  );
}

/** Opens the signature dialog and places the result on the current page. */
export const signatureTool: ActionTool = {
  kind: 'action',
  id: 'signature',
  label: 'Signature',
  icon: Signature,
  group: 'insert',
  shortcut: 'S',
  run: (ctx) => {
    const { page, size } = ctx;
    if (!page || !size) return;
    ctx.openDialog((close) => (
      <SignatureDialog
        onCancel={close}
        onDone={(src) => {
          close();
          const img = new Image();
          img.onload = () => {
            const w = Math.min(160, size.w / 3);
            const h = (w * img.naturalHeight) / img.naturalWidth;
            ctx.add({ kind: 'image', id: uid(), pageId: page.id, x: size.w - w - 60, y: size.h - h - 120, w, h, src, opacity: 1 });
            ctx.setTool('select');
          };
          img.src = src;
        }}
      />
    ));
  },
};
