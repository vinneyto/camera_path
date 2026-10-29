import type { GaussianPass } from "3dgs-tile-webgpu";
import { PerspectiveCamera, type WebGPURenderer } from "three/webgpu";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SceneRenderPipeline } from "@camera-path/render-pipeline";

import { TileGaussianRenderingBackend } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/tile-gaussian-rendering-backend";

const { gaussianPassMock, sparkBackendMock } = vi.hoisted(() => ({
  gaussianPassMock: vi.fn(),
  sparkBackendMock: vi.fn(),
}));

afterEach(() => vi.unstubAllGlobals());
vi.mock("3dgs-tile-webgpu/spark", () => ({
  WorkerSparkGaussianBackend: class {
    constructor() {
      sparkBackendMock();
    }
    dispose() {}
  },
}));

vi.mock("3dgs-tile-webgpu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("3dgs-tile-webgpu")>();
  return {
    ...actual,
    GaussianStore: class {
      dispose() {}
    },
    gaussianPass: gaussianPassMock,
  };
});

vi.mock(
  "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/create-tile-raster-depth-nodes",
  () => ({
    createTileRasterDepthNodes: () => ({
      rasterBreakNode: {},
      rasterDiscardNode: {},
      rasterPixelValueNode: {},
    }),
  }),
);

describe("TileGaussianRenderingBackend pass", () => {
  it("selects the upstream Spark worker only with the explicit experimental flag", () => {
    sparkBackendMock.mockClear();
    const pipeline = {
      camera: new PerspectiveCamera(),
      renderer: {},
    } as unknown as SceneRenderPipeline;
    const baseline = new TileGaussianRenderingBackend(pipeline);
    expect(sparkBackendMock).not.toHaveBeenCalled();
    baseline.dispose();
    vi.stubGlobal("window", { location: { search: "?gaussianBackend=spark" } });
    const experimental = new TileGaussianRenderingBackend(pipeline);
    expect(sparkBackendMock).toHaveBeenCalledOnce();
    experimental.dispose();
  });
  it("prepares concurrent models without invoking or waiting for explicit warmup", async () => {
    gaussianPassMock.mockReset();
    const pass = {
      depthSortMode: "float32",
      dispose: vi.fn(),
      getResolutionScale: () => 1,
      setResolutionScale: vi.fn(),
      warmup: vi.fn(() => new Promise<void>(() => {})),
    } as unknown as GaussianPass;
    gaussianPassMock.mockReturnValue(pass);
    const backend = new TileGaussianRenderingBackend({
      camera: new PerspectiveCamera(),
      renderer: { getPixelRatio: () => 1 },
      getOpaqueViewDepth: vi.fn(() => ({})),
      registerLayer: vi.fn(() => vi.fn()),
    } as unknown as SceneRenderPipeline);
    const error = new Error("stop after entering the model queue");
    const loadBuffer = vi.fn().mockRejectedValue(error);
    Object.assign((backend as unknown as { store: object }).store, {
      loadBuffer,
    });
    const completed = Promise.allSettled(
      Array.from({ length: 3 }, () =>
        backend.createCloud({
          kind: "buffer",
          buffer: new ArrayBuffer(0),
          name: "test.ply",
        }),
      ),
    );
    expect(gaussianPassMock).toHaveBeenCalledOnce();
    expect(pass.warmup).not.toHaveBeenCalled();
    expect(await completed).toEqual(
      Array.from({ length: 3 }, () => ({ status: "rejected", reason: error })),
    );
    expect(loadBuffer).toHaveBeenCalledTimes(3);
    backend.dispose();
  });

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
        depthAlphaThreshold: 0.95,
        outputDepth: false,
        redrawStrategy: "auto",
      },
    );
    expect(registerLayer).toHaveBeenCalledWith(pass, { order: -100 });
    backend.invalidate();
    expect(pass.invalidate).toHaveBeenCalledOnce();
    backend.dispose();
  });

  it("contributes Gaussian depth only while depth output is enabled", () => {
    gaussianPassMock.mockReset();
    const depthNodes = [{}, {}, {}];
    const passes = depthNodes.map((depth) => {
      let resolutionScale = 1;
      return {
        depthSortMode: "float32",
        dispose: vi.fn(),
        getResolutionScale: () => resolutionScale,
        getTextureNode: () => ({ r: depth }),
        invalidate: vi.fn(),
        setResolutionScale: (value: number) => {
          resolutionScale = value;
        },
      } as unknown as GaussianPass;
    });
    gaussianPassMock
      .mockReturnValueOnce(passes[0])
      .mockReturnValueOnce(passes[1])
      .mockReturnValueOnce(passes[2]);
    const registerLayer = vi.fn(() => vi.fn());
    const backend = new TileGaussianRenderingBackend({
      camera: new PerspectiveCamera(),
      getOpaqueViewDepth: vi.fn(() => ({})),
      registerLayer,
      renderer: { getPixelRatio: () => 1 } as unknown as WebGPURenderer,
    } as unknown as SceneRenderPipeline);

    (
      backend as unknown as {
        ensurePass(): void;
      }
    ).ensurePass();
    backend.setDepthEnabled(true);
    backend.setDepthEnabled(false);

    expect(
      gaussianPassMock.mock.calls.map((call) => call[3]?.outputDepth),
    ).toEqual([false, true, false]);
    expect(
      gaussianPassMock.mock.calls.map((call) => call[3]?.depthAlphaThreshold),
    ).toEqual([0.95, 0.95, 0.95]);
    expect(registerLayer).toHaveBeenNthCalledWith(1, passes[0], {
      order: -100,
    });
    expect(registerLayer).toHaveBeenNthCalledWith(2, passes[1], {
      depth: depthNodes[1],
      order: -100,
    });
    expect(registerLayer).toHaveBeenNthCalledWith(3, passes[2], {
      order: -100,
    });
    expect(backend.isDepthEnabled()).toBe(false);
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
