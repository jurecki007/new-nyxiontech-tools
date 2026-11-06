import { useState, type Dispatch } from 'react';
import { Copy, FilePlus2, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { Thumb } from './Thumb';
import { ops, uid, viewSize, type HistoryAction } from '../lib/doc';
import { pageKey } from '../lib/hooks';
import type { Annot, Doc, PageInfo, PageRef, Source } from '../types';
import { useT } from '../i18n';

interface Props {
  pages: PageRef[];
  sources: Source[];
  infos: Record<string, PageInfo>;
  annots: Annot[];
  activeId: string | null;
  dispatch: Dispatch<HistoryAction>;
  onActivate: (id: string) => void;
  onAddPdf: () => void;
}

export function PagesPanel({ pages, sources, infos, annots, activeId, dispatch, onActivate, onAddPdf }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const t = useT();

  const apply = (fn: (d: Doc) => Doc) => dispatch({ type: 'apply', fn, history: true });

  return (
    <aside className="pages-panel">
      <div className="panel-title">
        {t.editor.pages} <span className="count">{pages.length}</span>
      </div>
      <div className="pages-list">
        {pages.map((page, i) => {
          const info = infos[pageKey(page)];
          const source = sources.find((s) => s.id === page.sourceId)!;
          return (
            <div
              key={page.id}
              className={[
                'page-item',
                page.id === activeId && 'active',
                page.id === dragId && 'dragging',
                dropIndex === i && dragId !== page.id && 'drop-target',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable
              onDragStart={(e) => {
                setDragId(page.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setDropIndex(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) apply(ops.movePage(dragId, i));
                setDragId(null);
                setDropIndex(null);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropIndex(null);
              }}
              onClick={() => onActivate(page.id)}
            >
              {info ? (
                <Thumb source={source} page={page} info={info} width={124} annots={annots.filter((a) => a.pageId === page.id)} />
              ) : (
                <div className="thumb placeholder" />
              )}
              <div className="page-item-bar">
                <span className="page-no">{i + 1}</span>
                <span className="page-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    title={t.editor.rotateLeft}
                    disabled={!info}
                    onClick={() => info && apply(ops.rotatePage(page.id, false, viewSize(info, page)))}
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    title={t.editor.rotateRight}
                    disabled={!info}
                    onClick={() => info && apply(ops.rotatePage(page.id, true, viewSize(info, page)))}
                  >
                    <RotateCw size={14} />
                  </button>
                  <button title={t.editor.duplicatePage} onClick={() => apply(ops.duplicatePage(page.id, uid()))}>
                    <Copy size={14} />
                  </button>
                  <button title={t.editor.deletePage} className="danger" onClick={() => apply(ops.removePage(page.id))}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn add-pages" onClick={onAddPdf}>
        <FilePlus2 size={16} /> {t.editor.addPdfPages}
      </button>
    </aside>
  );
}
