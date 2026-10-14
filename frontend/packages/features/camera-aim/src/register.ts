import { camera_aim_deleteCameraKeyframe } from "@camera-path/contracts/feature-requests";
import * as calls from "@camera-path/contracts/host-requests";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "./manifest";
export function register(host: FeatureContext<typeof manifest>) {
  const off = [
    host.requests.handle(
      camera_aim_deleteCameraKeyframe,
      async (input, signal) => {
        const result = await host.requests.call(
          calls.deleteCameraKeyframe,
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
