import {
  identity_cancelLogin,
  identity_login,
  identity_logout,
  identity_resend,
  identity_verify,
} from "@camera-path/contracts/feature-requests";
import {
  identityState,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import {
  cancelLogin,
  login,
  logout,
  resend,
  verify,
} from "@camera-path/contracts/host-requests";
import type { FeatureManifest } from "@camera-path/extension-api";
export const manifest = {
  manifestVersion: 1,
  id: "identity",
  scope: "application",
  data: {
    provides: [],
    reads: [
      { contract: identityState, access: ["read", "readAsync", "subscribe"] },
      {
        contract: projectPermissions,
        access: ["read", "readAsync", "subscribe"],
      },
    ],
  },
  requests: {
    calls: [login, verify, resend, cancelLogin, logout],
    handles: [
      identity_login,
      identity_verify,
      identity_resend,
      identity_cancelLogin,
      identity_logout,
    ],
  },
  frames: [],
  contributions: [],
  capabilities: [],
} as const satisfies FeatureManifest<"identity">;
