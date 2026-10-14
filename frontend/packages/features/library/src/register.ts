import {
  library_deleteLibraryAssets,
  library_navigate,
  library_updateLibraryDefaults,
  library_uploadLibraryFile,
} from "@camera-path/contracts/feature-requests";
import * as calls from "@camera-path/contracts/host-requests";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "./manifest";
export function register(host: FeatureContext<typeof manifest>) {
  const off = [
    host.requests.handle(library_uploadLibraryFile, async (input, signal) => {
      const result = await host.requests.call(calls.uploadLibraryFile, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(library_deleteLibraryAssets, async (input, signal) => {
      const result = await host.requests.call(
        calls.deleteLibraryAssets,
        input,
        { signal },
      );
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(
      library_updateLibraryDefaults,
      async (input, signal) => {
        const result = await host.requests.call(
          calls.updateLibraryDefaults,
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
    host.requests.handle(library_navigate, async (input, signal) => {
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
