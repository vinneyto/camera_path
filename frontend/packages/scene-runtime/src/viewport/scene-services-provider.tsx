"use client";
import type { Vec3 } from "@camera-path/types/project";
import { createContext, useContext, type ReactNode } from "react";
import type { GaussianRenderingBackend, SceneSurfaceReady } from "../surface";
export interface SceneServices {
  backend: GaussianRenderingBackend;
  interactive: boolean;
  dark: boolean;
  bottomInset: number;
  depthSupported: boolean;
  radius: number | null;
  orbitTarget: Vec3;
  setOrbitTarget: (target: Vec3) => void;
  frame: (bounds: SceneSurfaceReady["bounds"]) => void;
  reportBounds: (
    id: string,
    bounds: SceneSurfaceReady["bounds"] | null,
  ) => void;
  requestDepth: (id: string, enabled: boolean) => void;
}
const Context = createContext<SceneServices | null>(null);
export function SceneServicesProvider({
  value,
  children,
}: {
  value: SceneServices;
  children: ReactNode;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSceneServices() {
  const value = useContext(Context);
  if (!value) throw Error("SceneServicesProvider is required");
  return value;
}
