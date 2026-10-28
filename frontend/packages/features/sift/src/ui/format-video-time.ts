export function formatVideoTime(seconds: number) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const suffix = `${minutes.toString().padStart(hours ? 2 : 1, "0")}:${(total % 60).toString().padStart(2, "0")}`;
  return hours ? `${hours}:${suffix}` : suffix;
}
