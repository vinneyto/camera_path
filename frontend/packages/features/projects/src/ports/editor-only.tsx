"use client";
import { projectPermissions } from "@camera-path/contracts/host-data";
import { useData } from "@camera-path/extension-api";
import type { ReactNode } from "react";
import { manifest } from "../manifest";
export function EditorOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useData(manifest, projectPermissions).canEdit ? children : fallback;
}
