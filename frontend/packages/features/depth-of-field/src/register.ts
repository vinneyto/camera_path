import {
  depth_of_field_addDepthOfFieldKeyframe,
  depth_of_field_deleteDepthOfFieldKeyframe,
} from "@camera-path/contracts/feature-requests";
import * as calls from "@camera-path/contracts/host-requests";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "./manifest";
export function register(host: FeatureContext<typeof manifest>) {
  const off = [
    host.requests.handle(
      depth_of_field_addDepthOfFieldKeyframe,
      async (input, signal) => {
        const result = await host.requests.call(
          calls.addDepthOfFieldKeyframe,
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
      depth_of_field_deleteDepthOfFieldKeyframe,
      async (input, signal) => {
        const result = await host.requests.call(
          calls.deleteDepthOfFieldKeyframe,
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
