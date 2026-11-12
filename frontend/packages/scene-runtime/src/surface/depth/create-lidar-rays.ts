import type { GaussianLidarSettings } from "../model/gaussian-lidar";
export function createLidarRays(settings: GaussianLidarSettings): Float32Array {
  const {
    horizontalResolution: width,
    verticalResolution: height,
    verticalFovDegrees,
  } = settings;
  const rays = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const elevation =
      ((0.5 - (y + 0.5) / height) * verticalFovDegrees * Math.PI) / 180;
    for (let x = 0; x < width; x++) {
      const azimuth = ((x + 0.5) / width - 0.5) * 2 * Math.PI;
      const i = (y * width + x) * 3;
      rays[i] = Math.sin(azimuth) * Math.cos(elevation);
      rays[i + 1] = Math.sin(elevation);
      rays[i + 2] = -Math.cos(azimuth) * Math.cos(elevation);
    }
  }
  return rays;
}
