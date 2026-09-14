"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { WebGLRenderer } from "three";
import { WebGPURenderer } from "three/webgpu";

import { useOptionalRenderPipeline } from "@/shared/three";

import { TileGaussianRenderingBackend } from "../adapters/3dgs-tile-webgpu/tile-gaussian-rendering-backend";
import { SparkGaussianRenderingBackend } from "../adapters/spark/spark-gaussian-rendering-backend";
import type { GaussianRenderingBackend } from "../model/gaussian-rendering-backend";
import type { GaussianDprMode } from "../model/gaussian-dpr-mode";
import type { SceneSurfaceBackground } from "../model/scene-surface-types";

const EMPTY_CLOUD_LAYERS: readonly number[] = [];

export function useGaussianRenderingBackend(
  background: SceneSurfaceBackground,
  dprMode: GaussianDprMode = "1x",
  depthEnabled = false,
  additionalCloudLayers: readonly number[] = EMPTY_CLOUD_LAYERS,
): GaussianRenderingBackend {
  const renderer = useThree((state) => state.gl);
  const pipeline = useOptionalRenderPipeline();
  // The backend is an imperative resource owner consumed outside React and
  // disposed by SceneSurfaceProvider; stable identity is part of that contract.
  const backend = useMemo(() => {
    if (renderer instanceof WebGPURenderer) {
      if (pipeline === null) {
        throw new Error(
          "WebGPU Gaussian rendering requires RenderPipelineProvider",
        );
      }
      return new TileGaussianRenderingBackend(pipeline, additionalCloudLayers);
    }
    if (renderer instanceof WebGLRenderer) {
      return new SparkGaussianRenderingBackend({
        additionalCloudLayers,
        renderer,
      });
    }
    throw new TypeError("Unsupported Three.js renderer");
  }, [additionalCloudLayers, pipeline, renderer]);

  useEffect(() => {
    if (backend instanceof SparkGaussianRenderingBackend) {
      backend.setBackground(background);
    }
  }, [backend, background]);

  useLayoutEffect(() => {
    backend.setDepthEnabled?.(depthEnabled);
    return () => backend.setDepthEnabled?.(false);
  }, [backend, depthEnabled]);

  useFrame(() => {
    if (backend instanceof TileGaussianRenderingBackend) {
      backend.syncResolutionScale(dprMode);
    }
  });

  return backend;
}
