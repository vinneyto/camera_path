import type { GaussianRenderStore } from "3dgs-tile-webgpu";
import { TileGaussianLidar } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/tile-gaussian-lidar";
import type { WebGPURenderer } from "three/webgpu";
import { expect, it, vi } from "vitest";

it("does not configure a backend camera or update selection and hides uninitialized output", () => {
  const unsubscribe = vi.fn();
  const setFrontendCapabilities = vi.fn(),
    updateLod = vi.fn();
  const store = {
    subscribe: () => unsubscribe,
    hasPackedData: false,
    setFrontendCapabilities,
    updateLod,
  } as unknown as GaussianRenderStore;
  const compute = vi.fn();
  const renderer = {
    backend: { device: { limits: {} } },
    getDrawingBufferSize: (target: { set: (x: number, y: number) => void }) =>
      target.set(800, 600),
    compute,
    hasFeature: () => false,
  } as unknown as WebGPURenderer;
  const released = vi.fn();
  const sensor = new TileGaussianLidar(
    renderer,
    store,
    {
      verticalFovDegrees: 60,
      horizontalResolution: 512,
      verticalResolution: 32,
    },
    released,
  );
  const geometryReleased = vi.fn(),
    materialReleased = vi.fn();
  sensor.object.geometry.addEventListener("dispose", geometryReleased);
  (sensor.object.material as import("three").Material).addEventListener(
    "dispose",
    materialReleased,
  );
  sensor.render();
  expect(setFrontendCapabilities).not.toHaveBeenCalled();
  expect(updateLod).not.toHaveBeenCalled();
  expect(compute).not.toHaveBeenCalled();
  expect(sensor.object.visible).toBe(false);
  sensor.dispose();
  sensor.dispose();
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(geometryReleased).toHaveBeenCalledOnce();
  expect(materialReleased).toHaveBeenCalledOnce();
  expect(released).toHaveBeenCalledOnce();
});
