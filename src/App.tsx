import { useState } from 'react';
import { Editor } from './components/Editor';
import { Shell } from './components/Shell';
import { createProject } from './lib/files';
import { saveProject } from './lib/storage';
import type { UtilityContext } from './utilities';
import type { Project } from './types';

export function App() {
  const [editing, setEditing] = useState<{ project: Project; tool?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctx: UtilityContext = {
    openInEditor: (files, tool) => {
      setError(null);
      setBusy(true);
      void createProject(files)
        .then(async (project) => {
          if (!project) {
            setError('Please choose one or more PDF files.');
            return;
          }
          await saveProject(project);
          setEditing({ project, tool });
        })
        .catch((e: unknown) => setError(`Could not open this PDF: ${e instanceof Error ? e.message : String(e)}`))
        .finally(() => setBusy(false));
    },
  };

  if (editing) {
    const close = () => {
      // "Back to dashboard" lands on the dashboard, where the document now shows under Recent.
      window.location.hash = '#/';
      setEditing(null);
    };
    return <Editor key={editing.project.id} initial={editing.project} initialTool={editing.tool} onClose={close} />;
  }
  return (
    <>
      <Shell ctx={ctx} onOpenProject={(project) => setEditing({ project })} error={error} onDismissError={() => setError(null)} />
      {busy && <div className="busy">Opening…</div>}
    </>
  );
}
