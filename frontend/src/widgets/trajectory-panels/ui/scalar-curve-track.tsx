import {
  GRAPH_WIDTH,
  graphX,
  PLOT_LEFT,
  PLOT_RIGHT,
} from "../lib/graph-layout";
import type { ScalarTrackDescriptor } from "../model/timeline-track";
import { KeyframeTimeline } from "./keyframe-timeline";
import { TimelineTrackHeader } from "./timeline-track-header";

interface ScalarCurveTrackProps {
  track: ScalarTrackDescriptor;
}

export function ScalarCurveTrack({ track }: ScalarCurveTrackProps) {
  const plotTop = 5;
  const plotBottom = track.height - 17;
  const [minimum, maximum] = track.domain;
  const valueY = (value: number) => {
    if (maximum === minimum) return (plotTop + plotBottom) / 2;
    return (
      plotBottom -
      ((value - minimum) / (maximum - minimum)) * (plotBottom - plotTop)
    );
  };
  const points = track.samples
    .map((sample) => `${graphX(sample.pathPosition)},${valueY(sample.value)}`)
    .join(" ");
  const zeroY = minimum <= 0 && maximum >= 0 ? valueY(0) : null;

  return (
    <div
      className="min-h-0 p-2 pt-1.5"
      data-plot-left={PLOT_LEFT}
      data-timeline-track={track.id}
    >
      <TimelineTrackHeader summary={track.summary} title={track.title} />
      <div className="relative w-full" style={{ height: track.height }}>
        <svg
          aria-label={track.title}
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${GRAPH_WIDTH} ${track.height}`}
        >
          {zeroY !== null && (
            <line
              stroke="var(--chart-grid)"
              vectorEffect="non-scaling-stroke"
              x1={PLOT_LEFT}
              x2={PLOT_RIGHT}
              y1={zeroY}
              y2={zeroY}
            />
          )}
          <polyline
            fill="none"
            points={points}
            stroke={track.color}
            strokeLinejoin="round"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className="absolute left-0 -translate-y-1/2 text-[7px] tabular-nums text-muted-foreground"
          style={{ top: plotTop }}
        >
          {maximum.toFixed(0)}°
        </span>
        <span
          className="absolute left-0 -translate-y-1/2 text-[7px] tabular-nums text-muted-foreground"
          style={{ top: plotBottom }}
        >
          {minimum.toFixed(0)}°
        </span>
        <KeyframeTimeline
          deleteLabel={track.deleteLabel}
          deletingKeyframeId={track.deletingKeyframeId}
          keyframes={track.keyframes.map((keyframe) => ({
            ...keyframe,
            top: valueY(keyframe.value),
          }))}
          onDeleteKeyframe={track.onDeleteKeyframe}
          renderMarker={track.renderMarker}
        />
      </div>
    </div>
  );
}
