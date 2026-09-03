import type { PlaybackSample } from "./create-playback-table";

export function timeAtPathPosition(table: PlaybackSample[], pathPosition: number): number {
  if (table.length === 0) return 0;
  const position = Math.min(1, Math.max(0, pathPosition));

  let low = 0;
  let high = table.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (table[middle].pathPosition <= position) low = middle;
    else high = middle;
  }

  const left = table[low];
  const right = table[high];
  const width = right.pathPosition - left.pathPosition;
  const weight = width > 0 ? (position - left.pathPosition) / width : 0;
  return left.time + (right.time - left.time) * weight;
}
