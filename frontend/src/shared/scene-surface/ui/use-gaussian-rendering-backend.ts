"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { WebGLRenderer } from "three";
import { WebGPURenderer } from "three/webgpu";

import { useOptionalRenderPipeline } from "@/shared/three";

import { TileGaussianRenderingBackend } from "../adapters/3dgs-tile-webgpu/tile-gaussian-rendering-backend";
import { SparkGaussianRenderingBackend } from "../adapters/spark/spark-gaussian-rendering-backend";
import type { GaussianRenderingBackend } from "../model/gaussian-rendering-backend";
import type { GaussianDprMode } from "../model/gaussian-dpr-mode";
import type { SceneSurfaceBackground } from "../model/scene-surface-types";

export function useGaussianRenderingBackend(
  background: SceneSurfaceBackground,
  dprMode: GaussianDprMode = "1x",
): GaussianRenderingBackend {
  const renderer = useThree((state) => state.gl);
  const pipeline = useOptionalRenderPipeline();
  const backend = useMemo(() => {
    if (renderer instanceof WebGPURenderer) {
      if (pipeline === null) {
        throw new Error(
          "WebGPU Gaussian rendering requires RenderPipelineProvider",
        );
      }
      return new TileGaussianRenderingBackend(pipeline);
    }
    if (renderer instanceof WebGLRenderer) {
      return new SparkGaussianRenderingBackend({ renderer });
    }
    throw new TypeError("Unsupported Three.js renderer");
  }, [pipeline, renderer]);

  useEffect(() => {
    if (backend instanceof SparkGaussianRenderingBackend) {
      backend.setBackground(background);
    }
  }, [backend, background]);

  useFrame(() => {
    if (backend instanceof TileGaussianRenderingBackend) {
      backend.syncResolutionScale(dprMode);
    }
  });

  return backend;
}
