import { useEffect, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { removeBackground, type BackgroundMode } from '../lib/background';
import { decodeImage } from '../lib/images';
import { baseName } from '../lib/pdfTools';
import { ColorField } from '../components/fields';
import { FileDrop, FileList, Option, Results, RunBar, Segmented, ToolPage, useTask, type OutputFile } from './ui';
import type { Utility } from './types';

export const backgroundUtility: Utility = {
  id: 'remove-background',
  label: 'Remove background',
  description: 'Cut out products, people or logos and get a transparent PNG.',
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

    useEffect(() => {
      const urls = out.map((f) => URL.createObjectURL(f.blob));
      setPreviews(urls);
      return () => urls.forEach((u) => URL.revokeObjectURL(u));
    }, [out]);

    return (
      <ToolPage utility={backgroundUtility}>
        <FileDrop accept="image/*,.heic" multiple compact={files.length > 0} onFiles={(f) => setFiles([...files, ...f])} title="Add images" hint="JPG, PNG, WebP, HEIC" />
        {files.length > 0 && <FileList files={files} onChange={setFiles} />}
        <Option
          label="Method"
          hint={
            mode === 'ai'
              ? 'An on-device AI model finds the main subject. Works best with one clear subject. The first run loads the model (about 5 MB).'
              : 'Removes the colour around the edges (white paper, studio backdrop), keeping the same colour inside the subject.'
          }
        >
          <Segmented<BackgroundMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'ai', label: 'AI: photos' },
              { value: 'colour', label: 'Plain colour: logos, scans' },
            ]}
          />
        </Option>
        {mode === 'colour' && (
          <Option label={`Tolerance ${tolerance}`} hint="Raise it if some background remains; lower it if edges of the subject disappear.">
            <input className="range" type="range" min={2} max={80} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} />
          </Option>
        )}
        <Option label="New background">
          <div className="option-row">
            <Segmented<'none' | 'colour'>
              value={fill ? 'colour' : 'none'}
              onChange={(v) => setFill(v === 'none' ? null : '#ffffff')}
              options={[
                { value: 'none', label: 'Transparent' },
                { value: 'colour', label: 'Colour' },
              ]}
            />
            {fill && <ColorField label="" value={fill} onChange={setFill} />}
          </div>
        </Option>
        <RunBar
          label="Remove background"
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
