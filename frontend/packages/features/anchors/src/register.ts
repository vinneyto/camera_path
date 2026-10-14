import {
  anchors_addAnchor,
  anchors_clearHoveredAnchor,
  anchors_deleteAnchor,
  anchors_hoverAnchor,
  anchors_setActiveTool,
  anchors_updateAnchor,
} from "@camera-path/contracts/feature-requests";
import * as calls from "@camera-path/contracts/host-requests";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "./manifest";
export function register(host: FeatureContext<typeof manifest>) {
  const off = [
    host.requests.handle(anchors_addAnchor, async (input, signal) => {
      const result = await host.requests.call(calls.addAnchor, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(anchors_updateAnchor, async (input, signal) => {
      const result = await host.requests.call(calls.updateAnchor, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(anchors_deleteAnchor, async (input, signal) => {
      const result = await host.requests.call(calls.deleteAnchor, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(anchors_setActiveTool, async (input, signal) => {
      const result = await host.requests.call(calls.setActiveTool, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(anchors_hoverAnchor, async (input, signal) => {
      const result = await host.requests.call(calls.hoverAnchor, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(anchors_clearHoveredAnchor, async (input, signal) => {
      const result = await host.requests.call(calls.clearHoveredAnchor, input, {
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
