export function getLine2RaycastThreshold(
  width: number,
  hitSlop: number,
  pixelRatio: number,
) {
  const cssWidth = Math.max(0, width);
  const cssHitSlop = Math.max(0, hitSlop);
  const dpr = Math.max(1, pixelRatio);
  return (cssWidth + cssHitSlop * 2) * dpr - cssWidth;
}
