import { useState } from 'react';
import { Editor } from './components/Editor';
import { Shell } from './components/Shell';
import { createProject } from './lib/files';
import { navigate } from './lib/route';
import { saveProject } from './lib/storage';
import { tr, useT } from './i18n';
import type { UtilityContext } from './utilities';
import type { Project } from './types';

export function App() {
  const [editing, setEditing] = useState<{ project: Project; tool?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const ctx: UtilityContext = {
    openInEditor: (files, tool) => {
      setError(null);
      setBusy(true);
      void createProject(files)
        .then(async (project) => {
          if (!project) {
            setError(tr().app.choosePdf);
            return;
          }
          await saveProject(project);
          setEditing({ project, tool });
        })
        .catch((e: unknown) => setError(tr().app.couldNotOpen(e instanceof Error ? e.message : String(e))))
        .finally(() => setBusy(false));
    },
  };

  if (editing) {
    const close = () => {
      // "Back to dashboard" lands on the dashboard, where the document now shows under Recent.
      navigate(null);
      setEditing(null);
    };
    return <Editor key={editing.project.id} initial={editing.project} initialTool={editing.tool} onClose={close} />;
  }
  return (
    <>
      <Shell ctx={ctx} onOpenProject={(project) => setEditing({ project })} error={error} onDismissError={() => setError(null)} />
      {busy && <div className="busy">{t.app.opening}</div>}
    </>
  );
}
