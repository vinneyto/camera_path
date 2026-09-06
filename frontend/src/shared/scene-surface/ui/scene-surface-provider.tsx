"use client";

import { createContext, type PropsWithChildren, useContext, useEffect } from "react";

import type { GaussianRenderingBackend } from "../model/gaussian-rendering-backend";

interface SceneSurfaceProviderProps extends PropsWithChildren {
  backend: GaussianRenderingBackend;
}

interface BackendOwnership {
  count: number;
  disposeTimer: number | null;
}

const SceneSurfaceBackendContext = createContext<GaussianRenderingBackend | null>(null);
const backendOwnership = new WeakMap<GaussianRenderingBackend, BackendOwnership>();

export function SceneSurfaceProvider({
  backend,
  children,
}: SceneSurfaceProviderProps) {
  useEffect(() => {
    const ownership = backendOwnership.get(backend) ?? { count: 0, disposeTimer: null };
    if (ownership.disposeTimer !== null) window.clearTimeout(ownership.disposeTimer);
    ownership.disposeTimer = null;
    ownership.count += 1;
    backendOwnership.set(backend, ownership);

    return () => {
      ownership.count -= 1;
      if (ownership.count !== 0) return;
      // Strict Mode immediately re-runs effects after its development probe.
      // Delaying disposal one tick lets that re-run retain the same backend.
      ownership.disposeTimer = window.setTimeout(() => {
        if (ownership.count !== 0) return;
        backendOwnership.delete(backend);
        backend.dispose();
      }, 0);
    };
  }, [backend]);

  const content = backend.container === null
    ? children
    : <primitive dispose={null} object={backend.container}>{children}</primitive>;

  return (
    <SceneSurfaceBackendContext.Provider value={backend}>
      {content}
    </SceneSurfaceBackendContext.Provider>
  );
}

export function useSceneSurfaceBackend(): GaussianRenderingBackend {
  const backend = useContext(SceneSurfaceBackendContext);
  if (backend === null) {
    throw new Error("SceneSurface must be rendered inside SceneSurfaceProvider");
  }
  return backend;
}
