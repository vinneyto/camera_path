/** Find the displayed frame at a media time in a sorted presentation timeline. */
export function findVideoFrame(times: Float64Array, time: number) {
  let low = 0;
  let high = times.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (times[middle] <= time) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 1);
}
