import { describe, expect, it, vi } from "vitest";
import type { GaussianPass } from "3dgs-tile-webgpu";
import { PerspectiveCamera, type WebGPURenderer } from "three/webgpu";

import type { SceneRenderPipeline } from "@/shared/three";

import { TileGaussianRenderingBackend } from "./tile-gaussian-rendering-backend";

const { gaussianPassMock } = vi.hoisted(() => ({
  gaussianPassMock: vi.fn(),
}));

vi.mock("3dgs-tile-webgpu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("3dgs-tile-webgpu")>();
  return { ...actual, gaussianPass: gaussianPassMock };
});

vi.mock("./create-tile-raster-depth-nodes", () => ({
  createTileRasterDepthNodes: () => ({
    rasterBreakNode: {},
    rasterDiscardNode: {},
    rasterPixelValueNode: {},
  }),
}));

describe("TileGaussianRenderingBackend pass", () => {
  it("enables automatic redraw caching only for the Gaussian layer", () => {
    gaussianPassMock.mockReset();
    let resolutionScale = 1;
    const pass = {
      depthSortMode: "float32",
      dispose: vi.fn(),
      getResolutionScale: () => resolutionScale,
      invalidate: vi.fn(),
      setResolutionScale: (value: number) => {
        resolutionScale = value;
      },
    } as unknown as GaussianPass;
    gaussianPassMock.mockReturnValue(pass);
    const camera = new PerspectiveCamera();
    const renderer = {
      getPixelRatio: () => 1,
    } as unknown as WebGPURenderer;
    const registerLayer = vi.fn(() => vi.fn());
    const pipeline = {
      camera,
      getOpaqueViewDepth: vi.fn(() => ({})),
      registerLayer,
      renderer,
    } as unknown as SceneRenderPipeline;
    const backend = new TileGaussianRenderingBackend(pipeline);

    (
      backend as unknown as {
        ensurePass(): void;
      }
    ).ensurePass();

    expect(gaussianPassMock).toHaveBeenCalledWith(
      renderer,
      camera,
      expect.anything(),
      {
        background: [0, 0, 0, 0],
        redrawStrategy: "auto",
      },
    );
    expect(registerLayer).toHaveBeenCalledWith(pass, { order: -100 });
    backend.invalidate();
    expect(pass.invalidate).toHaveBeenCalledOnce();
    backend.dispose();
  });
});

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
