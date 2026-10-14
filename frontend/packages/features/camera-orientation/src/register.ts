import {
  camera_orientation_addCameraOrientationKeyframe,
  camera_orientation_deleteCameraOrientationKeyframe,
  camera_orientation_updateCameraOrientationKeyframe,
  camera_orientation_updateDefaultCameraOrientation,
} from "@camera-path/contracts/feature-requests";
import * as calls from "@camera-path/contracts/host-requests";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "./manifest";
export function register(host: FeatureContext<typeof manifest>) {
  const off = [
    host.requests.handle(
      camera_orientation_addCameraOrientationKeyframe,
      async (input, signal) => {
        const result = await host.requests.call(
          calls.addCameraOrientationKeyframe,
          input,
          { signal },
        );
        if (!result.ok)
          throw Object.assign(new Error(result.error.message), {
            code: result.error.code,
          });
        return result.value;
      },
    ),
    host.requests.handle(
      camera_orientation_updateCameraOrientationKeyframe,
      async (input, signal) => {
        const result = await host.requests.call(
          calls.updateCameraOrientationKeyframe,
          input,
          { signal },
        );
        if (!result.ok)
          throw Object.assign(new Error(result.error.message), {
            code: result.error.code,
          });
        return result.value;
      },
    ),
    host.requests.handle(
      camera_orientation_updateDefaultCameraOrientation,
      async (input, signal) => {
        const result = await host.requests.call(
          calls.updateDefaultCameraOrientation,
          input,
          { signal },
        );
        if (!result.ok)
          throw Object.assign(new Error(result.error.message), {
            code: result.error.code,
          });
        return result.value;
      },
    ),
    host.requests.handle(
      camera_orientation_deleteCameraOrientationKeyframe,
      async (input, signal) => {
        const result = await host.requests.call(
          calls.deleteCameraOrientationKeyframe,
          input,
          { signal },
        );
        if (!result.ok)
          throw Object.assign(new Error(result.error.message), {
            code: result.error.code,
          });
        return result.value;
      },
    ),
  ];
  return () => off.forEach((dispose) => dispose());
}
