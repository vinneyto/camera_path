"use client";
import { useAuth } from "@camera-path/api/identity/auth-provider";

import type { ReactNode } from "react";
export function EditorOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useAuth().canEdit ? children : fallback;
}
