"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { ProfileControl } from "./ui/profile-control";
export const extension = {
  manifest,
  contributions: [{ id: "identity.profile", Component: ProfileControl }],
} as const satisfies Extension;
