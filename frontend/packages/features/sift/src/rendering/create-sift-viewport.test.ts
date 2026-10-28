// @vitest-environment happy-dom
import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import { createSiftViewport } from "./create-sift-viewport";
vi.mock("three", async (original) => {
  const actual = await original<typeof THREE>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement("canvas");
      setPixelRatio() {}
      getPixelRatio() {
        return 1;
      }
      setClearColor() {}
      setSize() {}
      setAnimationLoop() {}
      dispose() {}
      forceContextLoss() {}
    },
  };
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("holds a full-resolution image without modifying the points, then reuses the live video texture", () => {
  vi.stubGlobal("ImageBitmap", class {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const added = vi.spyOn(THREE.Scene.prototype, "add");
  const video = document.createElement("video");
  Object.defineProperties(video, {
    videoWidth: { value: 1920 },
    videoHeight: { value: 1080 },
  });
  const viewport = createSiftViewport(document.createElement("div"), video);
  const plane = added.mock.calls[0][0] as THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial
  >;
  const markers = added.mock.calls[1][0] as THREE.Points;
  const liveTexture = plane.material.map;
  const point = { x: 10, y: 20, size: 1, octave: 0, class_id: 1, response: 1 };
  viewport.setPoints([point], 480, 270);
  viewport.holdMedia();
  const held = plane.material.map as THREE.CanvasTexture;
  expect(held).not.toBe(liveTexture);
  expect(held.image.width).toBe(1920);
  expect(held.image.height).toBe(1080);
  expect(drawImage).toHaveBeenCalledExactlyOnceWith(video, 0, 0);
  viewport.refreshMedia();
  viewport.holdMedia(); // a superseding step must not overwrite the previously visible frame
  expect(drawImage).toHaveBeenCalledOnce();
  expect(plane.material.map).toBe(held);
  expect(markers.geometry.drawRange.count).toBe(1);
  viewport.setPoints([], 480, 270); // an empty detection is still a complete result
  viewport.releaseMedia();
  expect(plane.material.map).toBe(liveTexture);
  expect(markers.geometry.drawRange.count).toBe(0);
  const disposed = vi.spyOn(held, "dispose");
  viewport.dispose();
  expect(disposed).toHaveBeenCalledOnce();
  expect(held.image.width).toBe(0);
});
