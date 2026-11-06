import { useEffect, useRef, useState } from 'react';
import { Editor } from './components/Editor';
import { Shell } from './components/Shell';
import { createProject, isImage, isPdf } from './lib/files';
import { receiveLaunchedFiles, registerServiceWorker, setLaunchedImages } from './lib/pwa';
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

  // Files opened from the OS or shared from another app (installed web app only):
  // PDFs open in the editor as if dropped on the dashboard, images in Images to PDF.
  const openInEditor = useRef(ctx.openInEditor);
  openInEditor.current = ctx.openInEditor;
  useEffect(() => {
    registerServiceWorker();
    receiveLaunchedFiles(
      (files) => {
        const pdfs = files.filter(isPdf);
        const images = files.filter((f) => !isPdf(f) && isImage(f));
        if (pdfs.length) return openInEditor.current(pdfs);
        if (images.length) {
          setEditing(null);
          setLaunchedImages(images);
          return navigate('images-to-pdf');
        }
        setError('Please choose one or more PDF files.');
      },
      setError,
    );
  }, []);

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
