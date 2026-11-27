import type { GaussianLidarSettings } from "../model/gaussian-lidar";
import { LIDAR_MAX_FACE_SIZE, LIDAR_MIN_FACE_SIZE } from "./constants";
export function getLidarFaceSize(settings: GaussianLidarSettings): number {
  return Math.min(
    LIDAR_MAX_FACE_SIZE,
    Math.max(
      LIDAR_MIN_FACE_SIZE,
      2 ** Math.ceil(Math.log2(settings.horizontalResolution / 4)),
    ),
  );
}
