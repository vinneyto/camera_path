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
  reads: [identityState, projectPermissions],
  calls: [login, verify, resend, cancelLogin, logout],
  frames: [],
  contributions: [
    { id: "identity.profile", kind: "ui", slot: "header.controls", order: 10 },
  ],
  capabilities: [],
} as const satisfies FeatureManifest<"identity">;
