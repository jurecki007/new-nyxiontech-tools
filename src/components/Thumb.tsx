import { useEffect, useRef } from 'react';
import { AnnotShape } from './AnnotShape';
import { effectiveRotation, viewSize } from '../lib/doc';
import { renderPage } from '../lib/pdfjs';
import type { Annot, PageInfo, PageRef, Source } from '../types';

/** A small, non-interactive render of a page with its annotations. */
export function Thumb({
  source,
  page,
  info,
  width,
  annots = [],
}: {
  source: Source;
  page: PageRef;
  info: PageInfo;
  width: number;
  annots?: Annot[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rotation = effectiveRotation(info, page);
  const size = viewSize(info, page);
  const scale = width / size.w;
  const height = size.h * scale;

  useEffect(() => {
    if (!ref.current) return;
    return renderPage(source, page.index, rotation, scale, ref.current);
  }, [source, page.index, rotation, scale]);

  return (
    <div className="thumb" style={{ width, height }}>
      <canvas ref={ref} style={{ width, height }} />
      {annots.length > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${size.w} ${size.h}`}>
          {annots.map((a) => (
            <AnnotShape key={a.id} annot={a} />
          ))}
        </svg>
      )}
    </div>
  );
}
