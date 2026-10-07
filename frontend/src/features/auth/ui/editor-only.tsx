"use client";

import type { ReactNode } from "react";
import { useAuth } from "../model/auth-provider";

interface EditorOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function EditorOnly({ children, fallback = null }: EditorOnlyProps) {
  const { canEdit } = useAuth();
  return canEdit ? children : fallback;
}
