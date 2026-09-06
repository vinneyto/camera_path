"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { GaussianStore, gaussianPass } from "3dgs-tile-webgpu";
import { PerspectiveCamera } from "three/webgpu";

import { useRenderPipeline } from "@/shared/three";

import type { SceneSurfaceAdapterProviderProps } from "../../model/scene-surface-types";

interface TileSurfaceContextValue {
  registerSurface: () => () => void;
  store: GaussianStore;
}

const TileSurfaceContext = createContext<TileSurfaceContextValue | null>(null);

export function TileSurfaceProvider({ background, children }: SceneSurfaceAdapterProviderProps) {
  const { camera, registerLayer, renderer } = useRenderPipeline();
  const [store] = useState(() => new GaussianStore());
  const [surfaceCount, setSurfaceCount] = useState(0);

  const registerSurface = useCallback(() => {
    setSurfaceCount((count) => count + 1);
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      setSurfaceCount((count) => Math.max(0, count - 1));
    };
  }, []);

  const value = useMemo(() => ({ registerSurface, store }), [registerSurface, store]);
  const backgroundKey = background.join(",");

  useEffect(() => {
    if (surfaceCount === 0) return;
    if (!(camera instanceof PerspectiveCamera)) {
      throw new TypeError("3dgs-tile-webgpu requires a PerspectiveCamera");
    }

    const pass = gaussianPass(renderer, camera, store, { background });
    const unregister = registerLayer(pass, { order: -100 });

    return () => {
      unregister();
      pass.dispose();
    };
  // backgroundKey deliberately tracks tuple values instead of tuple identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundKey, camera, registerLayer, renderer, store, surfaceCount]);

  useEffect(() => () => store.dispose(), [store]);

  return (
    <TileSurfaceContext.Provider value={value}>
      {children}
    </TileSurfaceContext.Provider>
  );
}

export function useTileSurface(): TileSurfaceContextValue {
  const value = useContext(TileSurfaceContext);
  if (value === null) {
    throw new Error("TileSurface must be rendered inside TileSurfaceProvider");
  }
  return value;
}
