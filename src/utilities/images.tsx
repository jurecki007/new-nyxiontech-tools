import { useState } from 'react';
import { ImageDown, Smartphone } from 'lucide-react';
import { baseName } from '../lib/pdfTools';
import { decodeImage, encodeImage, extensionFor, type ImageFormat } from '../lib/images';
import { formatBytes } from '../lib/zip';
import { NumberField } from '../components/fields';
import { FileDrop, FileList, Option, Results, RunBar, Segmented, ToolPage, useTask, type OutputFile } from './ui';
import type { Utility } from './types';
import { useT } from '../i18n';

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
  const all = useT();
  const t = all.images;

  return (
    <ToolPage utility={utility}>
      <FileDrop accept="image/*,.heic,.heif" multiple compact={files.length > 0} onFiles={(f) => setFiles([...files, ...f])} title={t.add} hint="JPG, PNG, WebP, GIF, BMP, HEIC" />
      {files.length > 0 && <FileList files={files} onChange={setFiles} />}
      <Option label={t.saveAs}>
        <Segmented<ImageFormat>
          value={format}
          onChange={setFormat}
          options={[
            { value: 'jpeg', label: 'JPG' },
            { value: 'webp', label: 'WebP', hint: t.webpHint },
            { value: 'png', label: 'PNG', hint: t.pngHint },
          ]}
        />
      </Option>
      {format !== 'png' && (
        <Option label={t.quality(quality)} hint={t.qualityHint}>
          <input className="range" type="range" min={30} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
        </Option>
      )}
      <Option label={t.resize}>
        <label className="check">
          <input type="checkbox" checked={resize} onChange={(e) => setResize(e.target.checked)} />
          {t.shrink}
        </label>
        {resize && (
          <div className="option-row narrow">
            <NumberField label={t.maxWidth} value={maxW} min={16} onChange={setMaxW} />
            <NumberField label={t.maxHeight} value={maxH} min={16} onChange={setMaxH} />
          </div>
        )}
      </Option>
      <RunBar
        label={t.run(files.length)}
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
              <b>{all.common.sizeChange(formatBytes(before), formatBytes(after))}</b>
              {after < before && ` (${all.common.smaller(Math.round((1 - after / before) * 100))})`}. {t.exif}
            </>
          )
        }
      />
    </ToolPage>
  );
}

export const imageConverterUtility: Utility = {
  id: 'image-converter',
  icon: ImageDown,
  group: 'images',
  Component: () => <ImageConverter utility={imageConverterUtility} initialFormat="jpeg" />,
};

export const heicUtility: Utility = {
  id: 'heic-to-jpg',
  icon: Smartphone,
  group: 'images',
  Component: () => <ImageConverter utility={heicUtility} initialFormat="jpeg" />,
};
