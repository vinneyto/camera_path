import {
  projects_createProject,
  projects_deleteProject,
  projects_navigate,
} from "@camera-path/contracts/feature-requests";
import * as calls from "@camera-path/contracts/host-requests";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "./manifest";
export function register(host: FeatureContext<typeof manifest>) {
  const off = [
    host.requests.handle(projects_createProject, async (input, signal) => {
      const result = await host.requests.call(calls.createProject, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(projects_deleteProject, async (input, signal) => {
      const result = await host.requests.call(calls.deleteProject, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(projects_navigate, async (input, signal) => {
      const result = await host.requests.call(calls.navigate, input, {
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
