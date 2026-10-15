"use client";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { EditableProvider } from "@camera-path/ui-kit/editable-provider";
import type { ReactNode } from "react";
export function ApplicationUi({ children }: { children: ReactNode }) {
  return (
    <EditableProvider editable={useAuth().canEdit}>{children}</EditableProvider>
  );
}
