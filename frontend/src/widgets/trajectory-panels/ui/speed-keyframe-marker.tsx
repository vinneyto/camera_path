export function SpeedKeyframeMarker() {
  return (
    <>
      <span className="absolute inset-0 rounded-full border-2 border-[var(--chart-speed)] opacity-0 transition-opacity group-focus-visible:opacity-30 group-hover:opacity-30" />
      <span className="absolute inset-[5px] rounded-full border-2 border-[var(--chart-speed)] bg-card shadow-sm" />
    </>
  );
}
