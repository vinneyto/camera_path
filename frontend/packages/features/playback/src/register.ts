import {
  playback_resetPlayback,
  playback_setPlaybackFrame,
  playback_setPlaying,
} from "@camera-path/contracts/feature-requests";
import * as calls from "@camera-path/contracts/host-requests";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "./manifest";
export function register(host: FeatureContext<typeof manifest>) {
  const off = [
    host.requests.handle(playback_setPlaybackFrame, async (input, signal) => {
      const result = await host.requests.call(calls.setPlaybackFrame, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(playback_resetPlayback, async (input, signal) => {
      const result = await host.requests.call(calls.resetPlayback, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(playback_setPlaying, async (input, signal) => {
      const result = await host.requests.call(calls.setPlaying, input, {
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
