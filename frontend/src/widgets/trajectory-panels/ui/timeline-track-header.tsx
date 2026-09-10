interface TimelineTrackHeaderProps {
  summary: string;
  title: string;
}

export function TimelineTrackHeader({
  summary,
  title,
}: TimelineTrackHeaderProps) {
  return (
    <div className="mb-0.5 flex items-center justify-between">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {summary}
      </span>
    </div>
  );
}
