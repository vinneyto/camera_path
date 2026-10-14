"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { SidebarExtension } from "./ui/sidebar-extension";
export const extension = {
  manifest,
  contributions: [{ id: "chat-agent.sidebar", Component: SidebarExtension }],
} as const satisfies Extension;
