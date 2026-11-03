import { useLayoutEffect, useRef, useState } from 'react';
import { fontStyle, LINE_HEIGHT } from '../lib/fonts';
import type { Annot, TextAnnot } from '../types';

interface Props {
  annot: Annot;
  selected?: boolean;
  /** Off for thumbnails: no hit areas, outlines or handles. */
  interactive?: boolean;
  zoom?: number;
  /** Bumped whenever fonts finish loading, so text gets re-measured. */
  fontsVersion?: number;
}

export function AnnotShape({ annot: a, selected = false, interactive = false, zoom = 1, fontsVersion = 0 }: Props) {
  if (a.kind === 'text') return <TextShape annot={a} selected={selected} interactive={interactive} fontsVersion={fontsVersion} />;

  const handle = 10 / zoom;
  return (
    <g data-annot={interactive ? a.id : undefined} className={`annot${selected ? ' selected' : ''}`}>
      {a.kind === 'rect' ? (
        <rect
          x={a.x}
          y={a.y}
          width={a.w}
          height={a.h}
          fill={a.fill ?? 'none'}
          stroke={a.stroke ?? 'none'}
          strokeWidth={a.strokeWidth}
          opacity={a.opacity}
          pointerEvents={interactive ? 'all' : 'none'}
        />
      ) : (
        <image href={a.src} x={a.x} y={a.y} width={a.w} height={a.h} preserveAspectRatio="none" opacity={a.opacity} />
      )}
      {interactive && <rect className="outline" x={a.x} y={a.y} width={a.w} height={a.h} />}
      {interactive && selected && (
        <rect
          data-handle={a.id}
          className="handle"
          x={a.x + a.w - handle / 2}
          y={a.y + a.h - handle / 2}
          width={handle}
          height={handle}
        />
      )}
    </g>
  );
}

function TextShape({
  annot: a,
  selected,
  interactive,
  fontsVersion,
}: {
  annot: TextAnnot;
  selected: boolean;
  interactive: boolean;
  fontsVersion: number;
}) {
  const ref = useRef<SVGTextElement>(null);
  const [box, setBox] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (interactive && ref.current) setBox(ref.current.getBBox());
  }, [interactive, a.text, a.x, a.y, a.size, a.font, a.bold, a.italic, fontsVersion]);

  const pad = Math.max(1.5, a.size * 0.15);
  return (
    <g data-annot={interactive ? a.id : undefined} className={`annot${selected ? ' selected' : ''}`}>
      {interactive && box && (
        <rect
          x={box.x - pad}
          y={box.y - pad}
          width={box.width + pad * 2}
          height={box.height + pad * 2}
          fill="transparent"
          pointerEvents="all"
        />
      )}
      <text
        ref={ref}
        x={a.x}
        y={a.y}
        fontSize={a.size}
        fill={a.color}
        opacity={a.opacity}
        style={{ ...fontStyle(a.font, a.bold, a.italic), whiteSpace: 'pre' }}
        pointerEvents="none"
      >
        {a.text.split('\n').map((line, i) => (
          <tspan key={i} x={a.x} dy={i === 0 ? 0 : a.size * LINE_HEIGHT}>
            {line || ' '}
          </tspan>
        ))}
      </text>
      {interactive && box && (
        <rect
          className="outline"
          x={box.x - pad}
          y={box.y - pad}
          width={box.width + pad * 2}
          height={box.height + pad * 2}
        />
      )}
    </g>
  );
}
