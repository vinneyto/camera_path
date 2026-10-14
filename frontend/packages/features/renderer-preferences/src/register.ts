import {
  renderer_preferences_retryPreferences,
  renderer_preferences_savePreferences,
} from "@camera-path/contracts/feature-requests";
import * as calls from "@camera-path/contracts/host-requests";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "./manifest";
export function register(host: FeatureContext<typeof manifest>) {
  const off = [
    host.requests.handle(
      renderer_preferences_savePreferences,
      async (input, signal) => {
        const result = await host.requests.call(calls.savePreferences, input, {
          signal,
        });
        if (!result.ok)
          throw Object.assign(new Error(result.error.message), {
            code: result.error.code,
          });
        return result.value;
      },
    ),
    host.requests.handle(
      renderer_preferences_retryPreferences,
      async (input, signal) => {
        const result = await host.requests.call(calls.retryPreferences, input, {
          signal,
        });
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
