import {
  scene_models_projectCloudAction,
  scene_models_setActiveTool,
  scene_models_startCloudPlacement,
} from "@camera-path/contracts/feature-requests";
import * as calls from "@camera-path/contracts/host-requests";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "./manifest";
export function register(host: FeatureContext<typeof manifest>) {
  const off = [
    host.requests.handle(
      scene_models_projectCloudAction,
      async (input, signal) => {
        const result = await host.requests.call(
          calls.projectCloudAction,
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
      scene_models_startCloudPlacement,
      async (input, signal) => {
        const result = await host.requests.call(
          calls.startCloudPlacement,
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
    host.requests.handle(scene_models_setActiveTool, async (input, signal) => {
      const result = await host.requests.call(calls.setActiveTool, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
  ];
  return () => off.forEach((dispose) => dispose());
}
