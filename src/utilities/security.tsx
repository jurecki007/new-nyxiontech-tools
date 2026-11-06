import { useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { baseName, pdfBlob, protectPdf, unlockPdf } from '../lib/pdfTools';
import { FileDrop, Option, Results, RunBar, ToolPage, useTask, type OutputFile } from './ui';
import { formatBytes } from '../lib/zip';
import type { Utility } from './types';
import { useT } from '../i18n';

/** Picker for one PDF without parsing it (it may be encrypted). */
function RawPdfInput({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const t = useT();
  if (!file) return <FileDrop accept="application/pdf,.pdf" multiple={false} onFiles={([f]) => onFile(f)} title={t.common.chooseAPdf} hint={t.common.orDropItHere} />;
  return (
    <div className="single-file">
      <span className="file-name">{file.name}</span>
      <span className="muted">{formatBytes(file.size)}</span>
      <span className="spacer" />
      <button className="btn ghost" onClick={() => onFile(null)}>
        {t.common.changeFile}
      </button>
    </div>
  );
}

export const protectUtility: Utility = {
  id: 'protect',
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
    const t = useT().protect;
    return (
      <ToolPage utility={protectUtility}>
        <RawPdfInput file={file} onFile={setFile} />
        <Option label={t.password}>
          <input className="text-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Option>
        <Option label={t.repeat} hint={mismatch ? <span className="error-text">{t.mismatch}</span> : undefined}>
          <input className="text-field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Option>
        <Option label={t.permissions} hint={t.permissionsHint}>
          <div className="checks">
            {(
              [
                ['allowPrinting', t.allowPrinting],
                ['allowCopying', t.allowCopying],
                ['allowModifying', t.allowModifying],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="check">
                <input type="checkbox" checked={perms[key]} onChange={(e) => setPerms({ ...perms, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
        </Option>
        <Option label={t.owner} hint={t.ownerHint}>
          <input className="text-field" type="password" value={owner} onChange={(e) => setOwner(e.target.value)} autoComplete="new-password" />
        </Option>
        <RunBar
          label={t.run}
          disabled={!file || !password || password !== confirm}
          {...task}
          onRun={() =>
            task.run(async () => {
              const bytes = await protectPdf(new Uint8Array(await file!.arrayBuffer()), { userPassword: password, ownerPassword: owner, ...perms });
              setOut([{ name: `${baseName(file!.name)}_protected.pdf`, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results files={out} zipName="protected.zip" note={t.keepSafe} />
      </ToolPage>
    );
  },
};

export const unlockUtility: Utility = {
  id: 'unlock',
  icon: LockOpen,
  group: 'security',
  Component: function Unlock({ ctx }) {
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    const t = useT().unlock;
    return (
      <ToolPage utility={unlockUtility}>
        <RawPdfInput file={file} onFile={setFile} />
        <Option label={t.password} hint={t.passwordHint}>
          <input className="text-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Option>
        <RunBar
          label={t.run}
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
