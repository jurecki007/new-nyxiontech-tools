// Background removal: an on-device U²-Net model for photos, and a colour-key
// flood fill for logos, scans and product shots on a plain background.
import { tr } from '../i18n';

const vendor = (path: string) => new URL(`${import.meta.env.BASE_URL}vendor/${path}`, window.location.origin).href;

// The WebAssembly-only build: the default one also tries WebGPU and needs extra files.
type OrtModule = typeof import('onnxruntime-web/wasm');
type Session = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;

let sessionPromise: Promise<{ ort: OrtModule; session: Session }> | null = null;

function loadModel() {
  sessionPromise ??= (async () => {
    const ort = await import('onnxruntime-web/wasm');
    ort.env.wasm.wasmPaths = vendor('ort/');
    // Threads need cross-origin isolation, which a plain static server does not give.
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
    const session = await ort.InferenceSession.create(vendor('models/u2netp.onnx'), { executionProviders: ['wasm'] });
    return { ort, session };
  })().catch((e) => {
    sessionPromise = null;
    throw e;
  });
  return sessionPromise;
}

const SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

function canvasOf(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Returns a per-pixel alpha mask (0–255) at the image's size. */
async function predictMask(bitmap: ImageBitmap): Promise<Uint8ClampedArray> {
  const { ort, session } = await loadModel();
  const small = canvasOf(SIZE, SIZE);
  const sctx = small.getContext('2d')!;
  sctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
  const px = sctx.getImageData(0, 0, SIZE, SIZE).data;
  let max = 1;
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2]);
  const input = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    for (let c = 0; c < 3; c++) input[c * SIZE * SIZE + p] = (px[i + c] / max - MEAN[c]) / STD[c];
  }
  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) };
  const output = (await session.run(feeds))[session.outputNames[0]].data as Float32Array;

  let lo = Infinity;
  let hi = -Infinity;
  for (const v of output) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  // Scale the 320×320 prediction up to the image with the browser's smoothing.
  const maskSmall = canvasOf(SIZE, SIZE);
  const mctx = maskSmall.getContext('2d')!;
  const md = mctx.createImageData(SIZE, SIZE);
  for (let p = 0; p < SIZE * SIZE; p++) {
    const a = ((output[p] - lo) / (hi - lo || 1)) * 255;
    md.data.set([a, a, a, 255], p * 4);
  }
  mctx.putImageData(md, 0, 0);
  const full = canvasOf(bitmap.width, bitmap.height);
  const fctx = full.getContext('2d')!;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(maskSmall, 0, 0, bitmap.width, bitmap.height);
  const big = fctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
  const mask = new Uint8ClampedArray(bitmap.width * bitmap.height);
  for (let p = 0; p < mask.length; p++) mask[p] = big[p * 4];
  return mask;
}

/** Most common colour along the image border, quantised to reduce noise. */
function borderColour(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const counts = new Map<number, number>();
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < w; x++) {
    add(x, 0);
    add(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    add(0, y);
    add(w - 1, y);
  }
  const key = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return [((key >> 10) & 31) * 8 + 4, ((key >> 5) & 31) * 8 + 4, (key & 31) * 8 + 4];
}

/**
 * Makes the background colour transparent, flood-filling from the image edges
 * so the same colour inside the subject is kept. `tolerance` is 0–100.
 */
function colourKeyMask(d: Uint8ClampedArray, w: number, h: number, tolerance: number): Uint8ClampedArray {
  const [r, g, b] = borderColour(d, w, h);
  const limit = (tolerance / 100) * 160;
  const soft = limit * 1.4;
  const dist = (p: number) => Math.hypot(d[p * 4] - r, d[p * 4 + 1] - g, d[p * 4 + 2] - b);
  const mask = new Uint8ClampedArray(w * h).fill(255);
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (p: number) => {
    if (!seen[p] && dist(p) <= soft) {
      seen[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const dd = dist(p);
    // Fully transparent inside the tolerance, a soft ramp just beyond it for clean edges.
    mask[p] = dd <= limit ? 0 : Math.round(((dd - limit) / (soft - limit)) * 255);
    if (dd > limit) continue;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  return mask;
}

export type BackgroundMode = 'ai' | 'colour';

export async function removeBackground(
  bitmap: ImageBitmap,
  o: { mode: BackgroundMode; tolerance: number; fill: string | null },
): Promise<Blob> {
  const canvas = canvasOf(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = o.mode === 'ai' ? await predictMask(bitmap) : colourKeyMask(img.data, canvas.width, canvas.height, o.tolerance);
  for (let p = 0; p < mask.length; p++) img.data[p * 4 + 3] = Math.min(img.data[p * 4 + 3], mask[p]);
  ctx.putImageData(img, 0, 0);
  let result = canvas;
  if (o.fill) {
    result = canvasOf(canvas.width, canvas.height);
    const rctx = result.getContext('2d')!;
    rctx.fillStyle = o.fill;
    rctx.fillRect(0, 0, result.width, result.height);
    rctx.drawImage(canvas, 0, 0);
  }
  return new Promise((resolve, reject) => result.toBlob((b) => (b ? resolve(b) : reject(new Error(tr().errors.encodeImage))), 'image/png'));
}
