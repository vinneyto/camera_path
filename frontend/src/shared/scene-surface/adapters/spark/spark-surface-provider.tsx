"use client";

import { SparkRenderer } from "@sparkjsdev/spark";
import { useThree } from "@react-three/fiber";
import { createContext, useContext, useEffect, useMemo } from "react";
import { Color, WebGLRenderer } from "three";

import type { SceneSurfaceAdapterProviderProps } from "../../model/scene-surface-types";

const SparkSurfaceContext = createContext(false);

export function SparkSurfaceProvider({ background, children }: SceneSurfaceAdapterProviderProps) {
  const renderer = useThree((state) => state.gl);

  if (!(renderer instanceof WebGLRenderer)) {
    throw new TypeError("SparkSurfaceProvider requires Three.js WebGLRenderer");
  }

  const sparkRenderer = useMemo(() => new SparkRenderer({ renderer }), [renderer]);
  const backgroundKey = background.join(",");

  useEffect(() => {
    const previousColor = renderer.getClearColor(new Color()).clone();
    const previousAlpha = renderer.getClearAlpha();
    renderer.setClearColor(new Color().setRGB(background[0], background[1], background[2]), background[3]);
    return () => renderer.setClearColor(previousColor, previousAlpha);
  // backgroundKey deliberately tracks tuple values instead of tuple identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundKey, renderer]);

  useEffect(() => () => sparkRenderer.dispose(), [sparkRenderer]);

  return (
    <SparkSurfaceContext.Provider value>
      <primitive dispose={null} object={sparkRenderer}>{children}</primitive>
    </SparkSurfaceContext.Provider>
  );
}

export function useSparkSurface(): void {
  if (!useContext(SparkSurfaceContext)) {
    throw new Error("SparkSurface must be rendered inside SparkSurfaceProvider");
  }
}
