import {
  identity_cancelLogin,
  identity_login,
  identity_logout,
  identity_resend,
  identity_verify,
} from "@camera-path/contracts/feature-requests";
import * as calls from "@camera-path/contracts/host-requests";
import type { FeatureContext } from "@camera-path/extension-api";
import { manifest } from "./manifest";
export function register(host: FeatureContext<typeof manifest>) {
  const off = [
    host.requests.handle(identity_login, async (input, signal) => {
      const result = await host.requests.call(calls.login, input, { signal });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(identity_verify, async (input, signal) => {
      const result = await host.requests.call(calls.verify, input, { signal });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(identity_resend, async (input, signal) => {
      const result = await host.requests.call(calls.resend, input, { signal });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(identity_cancelLogin, async (input, signal) => {
      const result = await host.requests.call(calls.cancelLogin, input, {
        signal,
      });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
    host.requests.handle(identity_logout, async (input, signal) => {
      const result = await host.requests.call(calls.logout, input, { signal });
      if (!result.ok)
        throw Object.assign(new Error(result.error.message), {
          code: result.error.code,
        });
      return result.value;
    }),
  ];
  return () => off.forEach((dispose) => dispose());
}
