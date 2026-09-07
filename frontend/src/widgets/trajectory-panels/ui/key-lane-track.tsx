import { GRAPH_WIDTH, PLOT_LEFT, PLOT_RIGHT } from "../lib/graph-layout";
import type { KeyframeTrackDescriptor } from "../model/timeline-track";
import { KeyframeTimeline } from "./keyframe-timeline";
import { TimelineTrackHeader } from "./timeline-track-header";

interface KeyLaneTrackProps {
  track: KeyframeTrackDescriptor;
}

export function KeyLaneTrack({ track }: KeyLaneTrackProps) {
  return (
    <div className="min-h-0 p-2 pt-1.5" data-plot-left={PLOT_LEFT} data-timeline-track={track.id}>
      <TimelineTrackHeader summary={track.summary} title={track.title} />
      <div className="relative w-full" style={{ height: track.height }}>
        <svg
          aria-label={track.title}
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${GRAPH_WIDTH} ${track.height}`}
        >
          <line stroke={track.color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={track.lineY} y2={track.lineY} />
        </svg>
        <span className="absolute -translate-x-1/2 text-[8px] text-muted-foreground" style={{ left: `${(PLOT_LEFT / GRAPH_WIDTH) * 100}%`, top: track.lineY + 11 }}>0</span>
        <span className="absolute -translate-x-1/2 text-[8px] text-muted-foreground" style={{ left: `${(PLOT_RIGHT / GRAPH_WIDTH) * 100}%`, top: track.lineY + 11 }}>1</span>
        <KeyframeTimeline
          deleteLabel={track.deleteLabel}
          deletingKeyframeId={track.deletingKeyframeId}
          keyframes={track.keyframes.map((keyframe) => ({ ...keyframe, top: track.lineY }))}
          onDeleteKeyframe={track.onDeleteKeyframe}
          renderMarker={track.renderMarker}
        />
        {track.keyframes.length === 0 && track.emptyState && (
          <p className="absolute text-[9px] text-muted-foreground" style={{ left: `${(PLOT_LEFT / GRAPH_WIDTH) * 100}%`, top: track.lineY + 25 }}>
            {track.emptyState}
          </p>
        )}
      </div>
    </div>
  );
}
