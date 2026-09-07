import { describe, expect, it, vi } from "vitest";
import type { GaussianPass } from "3dgs-tile-webgpu";
import { PerspectiveCamera, type WebGPURenderer } from "three/webgpu";

import type { SceneRenderPipeline } from "@/shared/three";

import { TileGaussianRenderingBackend } from "./tile-gaussian-rendering-backend";

describe("TileGaussianRenderingBackend resolution scale", () => {
  it("updates the existing pass when mode or system DPR changes", () => {
    let systemDpr = 2;
    let resolutionScale = 1;
    const setResolutionScale = vi.fn((value: number) => {
      resolutionScale = value;
    });
    const pass = {
      getResolutionScale: () => resolutionScale,
      setResolutionScale,
    } as unknown as GaussianPass;
    const pipeline = {
      camera: new PerspectiveCamera(),
      renderer: {
        getPixelRatio: () => systemDpr,
      } as unknown as WebGPURenderer,
    } as unknown as SceneRenderPipeline;
    const backend = new TileGaussianRenderingBackend(pipeline);
    Object.assign(backend as unknown as Record<string, unknown>, { pass });

    backend.syncResolutionScale("1x");
    backend.syncResolutionScale("1x");
    systemDpr = 1.25;
    backend.syncResolutionScale("1x");
    backend.syncResolutionScale("system");

    expect(setResolutionScale.mock.calls.map(([scale]) => scale)).toEqual([
      0.5, 0.8, 1,
    ]);
  });
});
