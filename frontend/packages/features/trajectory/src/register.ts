import {
  trajectory_clearHoveredTrajectory,
  trajectory_clearTrajectory,
  trajectory_closeTrajectory,
  trajectory_hoverTrajectory,
  trajectory_selectTrajectory,
} from "@camera-path/contracts/feature-requests";
import * as calls from "@camera-path/contracts/host-requests";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "./manifest";
export function register(host: FeatureContext<typeof manifest>) {
  const off = [
    host.requests.handle(trajectory_clearTrajectory, async (input, signal) => {
      const result = await host.requests.call(calls.clearTrajectory, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(trajectory_hoverTrajectory, async (input, signal) => {
      const result = await host.requests.call(calls.hoverTrajectory, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(
      trajectory_clearHoveredTrajectory,
      async (input, signal) => {
        const result = await host.requests.call(
          calls.clearHoveredTrajectory,
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
    host.requests.handle(trajectory_selectTrajectory, async (input, signal) => {
      const result = await host.requests.call(calls.selectTrajectory, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(trajectory_closeTrajectory, async (input, signal) => {
      const result = await host.requests.call(calls.closeTrajectory, input, {
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
