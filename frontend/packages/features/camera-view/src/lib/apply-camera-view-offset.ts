import type { PerspectiveCamera } from "three";

export function applyCameraViewOffset(
  camera: PerspectiveCamera,
  viewportWidth: number,
  viewportHeight: number,
  bottomInset: number,
) {
  if (viewportWidth <= 0 || viewportHeight <= 0 || bottomInset <= 0) {
    camera.clearViewOffset();
    return;
  }

  const clampedBottomInset = Math.min(bottomInset, viewportHeight);
  camera.setViewOffset(
    viewportWidth,
    viewportHeight,
    0,
    clampedBottomInset / 2,
    viewportWidth,
    viewportHeight,
  );
}
