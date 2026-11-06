import { useEffect, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { removeBackground, type BackgroundMode } from '../lib/background';
import { decodeImage } from '../lib/images';
import { baseName } from '../lib/pdfTools';
import { ColorField } from '../components/fields';
import { FileDrop, FileList, Option, Results, RunBar, Segmented, ToolPage, useTask, type OutputFile } from './ui';
import type { Utility } from './types';
import { useT } from '../i18n';

export const backgroundUtility: Utility = {
  id: 'remove-background',
  icon: Wand2,
  group: 'images',
  Component: function RemoveBackground() {
    const [files, setFiles] = useState<File[]>([]);
    const [mode, setMode] = useState<BackgroundMode>('ai');
    const [tolerance, setTolerance] = useState(25);
    const [fill, setFill] = useState<string | null>(null);
    const [out, setOut] = useState<OutputFile[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const task = useTask();
    const t = useT().background;

    useEffect(() => {
      const urls = out.map((f) => URL.createObjectURL(f.blob));
      setPreviews(urls);
      return () => urls.forEach((u) => URL.revokeObjectURL(u));
    }, [out]);

    return (
      <ToolPage utility={backgroundUtility}>
        <FileDrop accept="image/*,.heic" multiple compact={files.length > 0} onFiles={(f) => setFiles([...files, ...f])} title={t.add} hint="JPG, PNG, WebP, HEIC" />
        {files.length > 0 && <FileList files={files} onChange={setFiles} />}
        <Option
          label={t.method}
          hint={mode === 'ai' ? t.aiHint : t.colourHint}
        >
          <Segmented<BackgroundMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'ai', label: t.ai },
              { value: 'colour', label: t.colour },
            ]}
          />
        </Option>
        {mode === 'colour' && (
          <Option label={t.tolerance(tolerance)} hint={t.toleranceHint}>
            <input className="range" type="range" min={2} max={80} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} />
          </Option>
        )}
        <Option label={t.newBackground}>
          <div className="option-row">
            <Segmented<'none' | 'colour'>
              value={fill ? 'colour' : 'none'}
              onChange={(v) => setFill(v === 'none' ? null : '#ffffff')}
              options={[
                { value: 'none', label: t.transparent },
                { value: 'colour', label: t.fillColour },
              ]}
            />
            {fill && <ColorField label="" value={fill} onChange={setFill} />}
          </div>
        </Option>
        <RunBar
          label={t.run}
          disabled={!files.length}
          {...task}
          onRun={() =>
            task.run(async (progress) => {
              const results: OutputFile[] = [];
              for (const [i, file] of files.entries()) {
                const bitmap = await decodeImage(file);
                const blob = await removeBackground(bitmap, { mode, tolerance, fill });
                bitmap.close();
                results.push({ name: `${baseName(file.name)}_cutout.png`, blob });
                progress(i + 1, files.length);
              }
              setOut(results);
            })
          }
        />
        <Results files={out} zipName="cutouts.zip" />
        {previews.length > 0 && (
          <div className="cutouts">
            {previews.map((src, i) => (
              <img key={src} src={src} alt={out[i]?.name} />
            ))}
          </div>
        )}
      </ToolPage>
    );
  },
};
