import { useState } from 'react';
import { ImageDown, Smartphone } from 'lucide-react';
import { baseName } from '../lib/pdfTools';
import { decodeImage, encodeImage, extensionFor, type ImageFormat } from '../lib/images';
import { formatBytes } from '../lib/zip';
import { NumberField } from '../components/fields';
import { FileDrop, FileList, Option, Results, RunBar, Segmented, ToolPage, useTask, type OutputFile } from './ui';
import type { Utility } from './types';

function ImageConverter({ utility, initialFormat }: { utility: Utility; initialFormat: ImageFormat }) {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<ImageFormat>(initialFormat);
  const [quality, setQuality] = useState(80);
  const [resize, setResize] = useState(false);
  const [maxW, setMaxW] = useState(1920);
  const [maxH, setMaxH] = useState(1920);
  const [out, setOut] = useState<OutputFile[]>([]);
  const task = useTask();
  const before = files.reduce((n, f) => n + f.size, 0);
  const after = out.reduce((n, f) => n + f.blob.size, 0);

  return (
    <ToolPage utility={utility}>
      <FileDrop accept="image/*,.heic,.heif" multiple compact={files.length > 0} onFiles={(f) => setFiles([...files, ...f])} title="Add images" hint="JPG, PNG, WebP, GIF, BMP, HEIC" />
      {files.length > 0 && <FileList files={files} onChange={setFiles} />}
      <Option label="Save as">
        <Segmented<ImageFormat>
          value={format}
          onChange={setFormat}
          options={[
            { value: 'jpeg', label: 'JPG' },
            { value: 'webp', label: 'WebP', hint: 'Smallest files; supported by all modern browsers' },
            { value: 'png', label: 'PNG', hint: 'Lossless, keeps transparency; larger files' },
          ]}
        />
      </Option>
      {format !== 'png' && (
        <Option label={`Quality ${quality}%`} hint="70–85% is usually indistinguishable from the original.">
          <input className="range" type="range" min={30} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
        </Option>
      )}
      <Option label="Resize">
        <label className="check">
          <input type="checkbox" checked={resize} onChange={(e) => setResize(e.target.checked)} />
          Shrink images larger than
        </label>
        {resize && (
          <div className="option-row narrow">
            <NumberField label="Max width (px)" value={maxW} min={16} onChange={setMaxW} />
            <NumberField label="Max height (px)" value={maxH} min={16} onChange={setMaxH} />
          </div>
        )}
      </Option>
      <RunBar
        label={`Convert ${files.length || ''} ${files.length === 1 ? 'image' : 'images'}`}
        disabled={!files.length}
        {...task}
        onRun={() =>
          task.run(async (progress) => {
            const results: OutputFile[] = [];
            for (const [i, file] of files.entries()) {
              const bitmap = await decodeImage(file);
              const { blob } = await encodeImage(bitmap, {
                format,
                quality: quality / 100,
                maxWidth: resize ? maxW : undefined,
                maxHeight: resize ? maxH : undefined,
              });
              bitmap.close();
              results.push({ name: `${baseName(file.name)}.${extensionFor(format)}`, blob });
              progress(i + 1, files.length);
            }
            setOut(results);
          })
        }
      />
      <Results
        files={out}
        zipName="images.zip"
        note={
          out.length > 0 && (
            <>
              {formatBytes(before)} → <b>{formatBytes(after)}</b>
              {after < before && ` (${Math.round((1 - after / before) * 100)}% smaller)`}. Location and camera data (EXIF) are removed.
            </>
          )
        }
      />
    </ToolPage>
  );
}

export const imageConverterUtility: Utility = {
  id: 'image-converter',
  label: 'Compress & convert images',
  description: 'Shrink, resize and convert photos and graphics between JPG, PNG and WebP in bulk.',
  icon: ImageDown,
  group: 'images',
  Component: () => <ImageConverter utility={imageConverterUtility} initialFormat="jpeg" />,
};

export const heicUtility: Utility = {
  id: 'heic-to-jpg',
  label: 'HEIC to JPG',
  description: 'Convert iPhone photos (HEIC) to JPG that opens everywhere.',
  icon: Smartphone,
  group: 'images',
  Component: () => <ImageConverter utility={heicUtility} initialFormat="jpeg" />,
};
