import type { PlaybackSample } from "@/entities/trajectory/lib/create-playback-table";

export function pathPositionAtTime(table: PlaybackSample[], time: number): number {
  if (table.length === 0 || time <= 0) return 0;
  const duration = table.at(-1)?.time ?? 0;
  if (time >= duration) return 1;

  let low = 0;
  let high = table.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (table[middle].time <= time) low = middle;
    else high = middle;
  }

  const left = table[low];
  const right = table[high];
  const weight = (time - left.time) / Math.max(right.time - left.time, 1e-9);
  return left.pathPosition + (right.pathPosition - left.pathPosition) * weight;
}
