import { OrthographicCamera, PerspectiveCamera, type Camera } from "three";

export function getCameraScaledHtmlScale(
  camera: Camera,
  distance: number,
  distanceFactor: number,
): number {
  if (camera instanceof OrthographicCamera) return camera.zoom * distanceFactor;
  if (!(camera instanceof PerspectiveCamera)) return distanceFactor;

  const verticalFov = camera.fov * Math.PI / 180;
  return distanceFactor / (2 * Math.tan(verticalFov / 2) * distance);
}
