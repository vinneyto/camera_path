import {
  GRAPH_HEIGHT,
  GRAPH_WIDTH,
  PLOT_BOTTOM,
  PLOT_LEFT,
  PLOT_RIGHT,
  PLOT_TOP,
} from "../lib/graph-layout";
import type { ScalarTrackDescriptor } from "../model/timeline-track";
import { KeyframeTimeline } from "./keyframe-timeline";
import { TimelineTrackHeader } from "./timeline-track-header";

interface ScalarCurveTrackProps {
  track: ScalarTrackDescriptor;
}

export function ScalarCurveTrack({ track }: ScalarCurveTrackProps) {
  const [minimum, maximum] = track.domain;
  const valueY = (value: number) => {
    const normalized = maximum === minimum ? 0 : (value - minimum) / (maximum - minimum);
    return PLOT_BOTTOM - normalized * (PLOT_BOTTOM - PLOT_TOP);
  };
  const points = track.samples
    .map((sample) => `${PLOT_LEFT + sample.pathPosition * (PLOT_RIGHT - PLOT_LEFT)},${valueY(sample.value)}`)
    .join(" ");
  const middleY = (PLOT_TOP + PLOT_BOTTOM) / 2;

  return (
    <div className="min-h-0 border-b p-2 pb-1" data-plot-left={PLOT_LEFT} data-timeline-track={track.id}>
      <TimelineTrackHeader summary={track.summary} title={track.title} />
      <div className="relative w-full" style={{ height: track.height }}>
        <svg
          aria-label={track.title}
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        >
          {[PLOT_TOP, middleY, PLOT_BOTTOM].map((y) => (
            <line key={y} stroke="var(--chart-grid)" vectorEffect="non-scaling-stroke" x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} />
          ))}
          <line stroke="var(--chart-grid)" vectorEffect="non-scaling-stroke" x1={PLOT_LEFT} x2={PLOT_LEFT} y1={PLOT_TOP} y2={PLOT_BOTTOM} />
          <polyline
            fill="none"
            points={points}
            stroke={track.color}
            strokeLinejoin="round"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="absolute left-0 top-[31px] text-[7px] text-muted-foreground">{track.yAxisLabel}</span>
        {[
          { label: maximum.toFixed(1), y: PLOT_TOP },
          { label: ((minimum + maximum) / 2).toFixed(1), y: middleY },
          { label: minimum.toFixed(1), y: PLOT_BOTTOM },
        ].map(({ label, y }) => (
          <span
            className="absolute -translate-y-1/2 text-right text-[7px] tabular-nums text-muted-foreground"
            key={`${label}-${y}`}
            style={{ left: "7.2%", top: y, width: "3.2%" }}
          >
            {label}
          </span>
        ))}
        <KeyframeTimeline
          deleteLabel={track.deleteLabel}
          deletingKeyframeId={track.deletingKeyframeId}
          keyframes={track.keyframes.map((keyframe) => ({ ...keyframe, top: valueY(keyframe.value) }))}
          onDeleteKeyframe={track.onDeleteKeyframe}
          renderMarker={track.renderMarker}
        />
      </div>
    </div>
  );
}
