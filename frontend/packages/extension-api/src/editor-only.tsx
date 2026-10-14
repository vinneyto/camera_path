"use client";
import { projectPermissions } from "@camera-path/contracts/host-data";
import type { ReactNode } from "react";
import { useData } from "./use-data";
const manifest = {
  manifestVersion: 1,
  id: "host-ui",
  scope: "application",
  data: {
    provides: [],
    reads: [{ contract: projectPermissions, access: ["read", "subscribe"] }],
  },
  requests: { calls: [], handles: [] },
  frames: [],
  contributions: [],
  capabilities: [],
} as const;

interface EditorOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function EditorOnly({ children, fallback = null }: EditorOnlyProps) {
  const { canEdit } = useData(manifest, projectPermissions);
  return canEdit ? children : fallback;
}
