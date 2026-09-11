interface TimelineTrackHeaderProps {
  summary: string;
  title: string;
}

export function TimelineTrackHeader({
  summary,
  title,
}: TimelineTrackHeaderProps) {
  return (
    <div className="flex items-center justify-between leading-none">
      <h3 className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <span className="text-[9px] tabular-nums text-muted-foreground">
        {summary}
      </span>
    </div>
  );
}
