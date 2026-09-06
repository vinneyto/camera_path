"use client";

import { createContext, useContext } from "react";

import { tileSceneSurfaceAdapter } from "../adapters/3dgs-tile-webgpu/tile-scene-surface-adapter";
import type {
  SceneSurfaceAdapter,
  SceneSurfaceAdapterProviderProps,
} from "../model/scene-surface-types";

interface SceneSurfaceProviderProps extends SceneSurfaceAdapterProviderProps {
  adapter?: SceneSurfaceAdapter;
}

const SceneSurfaceAdapterContext = createContext<SceneSurfaceAdapter>(tileSceneSurfaceAdapter);

export function SceneSurfaceProvider({
  adapter = tileSceneSurfaceAdapter,
  background,
  children,
}: SceneSurfaceProviderProps) {
  const AdapterProvider = adapter.Provider;
  return (
    <SceneSurfaceAdapterContext.Provider value={adapter}>
      <AdapterProvider background={background}>{children}</AdapterProvider>
    </SceneSurfaceAdapterContext.Provider>
  );
}

export function useSceneSurfaceAdapter(): SceneSurfaceAdapter {
  return useContext(SceneSurfaceAdapterContext);
}
