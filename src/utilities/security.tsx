import { useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { baseName, pdfBlob, protectPdf, unlockPdf } from '../lib/pdfTools';
import { FileDrop, Option, Results, RunBar, ToolPage, useTask, type OutputFile } from './ui';
import { formatBytes } from '../lib/zip';
import type { Utility } from './types';

/** Picker for one PDF without parsing it (it may be encrypted). */
function RawPdfInput({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  if (!file) return <FileDrop accept="application/pdf,.pdf" multiple={false} onFiles={([f]) => onFile(f)} title="Choose a PDF" hint="or drop it here" />;
  return (
    <div className="single-file">
      <span className="file-name">{file.name}</span>
      <span className="muted">{formatBytes(file.size)}</span>
      <span className="spacer" />
      <button className="btn ghost" onClick={() => onFile(null)}>
        Change file
      </button>
    </div>
  );
}

export const protectUtility: Utility = {
  id: 'protect',
  label: 'Protect PDF',
  description: 'Add a password (AES-256) so only people who know it can open the file.',
  icon: Lock,
  group: 'security',
  Component: function Protect() {
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [owner, setOwner] = useState('');
    const [perms, setPerms] = useState({ allowPrinting: true, allowCopying: false, allowModifying: false });
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    const mismatch = confirm.length > 0 && confirm !== password;
    return (
      <ToolPage utility={protectUtility}>
        <RawPdfInput file={file} onFile={setFile} />
        <Option label="Password">
          <input className="text-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Option>
        <Option label="Repeat" hint={mismatch ? <span className="error-text">The passwords do not match.</span> : undefined}>
          <input className="text-field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Option>
        <Option label="Permissions" hint="Honoured by Adobe Reader, browsers and most viewers; some tools ignore them.">
          <div className="checks">
            {(
              [
                ['allowPrinting', 'Allow printing'],
                ['allowCopying', 'Allow copying text and images'],
                ['allowModifying', 'Allow editing and annotating'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="check">
                <input type="checkbox" checked={perms[key]} onChange={(e) => setPerms({ ...perms, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
        </Option>
        <Option label="Owner password" hint="Optional. Lets you change the permissions later. If empty, a random one is used.">
          <input className="text-field" type="password" value={owner} onChange={(e) => setOwner(e.target.value)} autoComplete="new-password" />
        </Option>
        <RunBar
          label="Protect PDF"
          disabled={!file || !password || password !== confirm}
          {...task}
          onRun={() =>
            task.run(async () => {
              const bytes = await protectPdf(new Uint8Array(await file!.arrayBuffer()), { userPassword: password, ownerPassword: owner, ...perms });
              setOut([{ name: `${baseName(file!.name)}_protected.pdf`, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results files={out} zipName="protected.zip" note="Keep the password somewhere safe: it cannot be recovered." />
      </ToolPage>
    );
  },
};

export const unlockUtility: Utility = {
  id: 'unlock',
  label: 'Unlock PDF',
  description: 'Remove the password from a PDF you are allowed to open.',
  icon: LockOpen,
  group: 'security',
  Component: function Unlock({ ctx }) {
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    return (
      <ToolPage utility={unlockUtility}>
        <RawPdfInput file={file} onFile={setFile} />
        <Option label="Password" hint="Leave empty for files that open without a password but block printing or copying.">
          <input className="text-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Option>
        <RunBar
          label="Unlock PDF"
          disabled={!file}
          {...task}
          onRun={() =>
            task.run(async () => {
              const bytes = await unlockPdf(new Uint8Array(await file!.arrayBuffer()), password);
              setOut([{ name: `${baseName(file!.name)}_unlocked.pdf`, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results files={out} zipName="unlocked.zip" ctx={ctx} />
      </ToolPage>
    );
  },
};
