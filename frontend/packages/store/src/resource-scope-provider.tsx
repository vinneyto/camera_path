"use client";
import { createContext, useContext, type ReactNode } from "react";
const Context = createContext<{ projectId?: string; assetId?: string }>({});
export function ResourceScopeProvider({
  projectId,
  assetId,
  children,
}: {
  projectId?: string;
  assetId?: string;
  children: ReactNode;
}) {
  return (
    <Context.Provider value={{ projectId, assetId }}>
      {children}
    </Context.Provider>
  );
}
export function useProjectId(explicitId?: string) {
  const scope = useContext(Context);
  if (explicitId && scope.projectId && explicitId !== scope.projectId)
    throw new Error("Project scope mismatch");
  const id = explicitId ?? scope.projectId;
  if (!id) throw new Error("Project resource scope is required");
  return id;
}
export function useAssetId(explicitId?: string) {
  const scope = useContext(Context);
  if (explicitId && scope.assetId && explicitId !== scope.assetId)
    throw new Error("Asset scope mismatch");
  const id = explicitId ?? scope.assetId;
  if (!id) throw new Error("Asset resource scope is required");
  return id;
}
