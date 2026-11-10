import { Camera, Matrix4, Scene } from "three";
import { expect, it, vi } from "vitest";
import { SceneDepthLidar } from "./scene-depth-lidar";
import type { SceneDepthCube } from "./scene-depth-capture";

it("shares pose-snapshot, throttling, hit placement and disposal across adapters", async () => {
  let finish!: (value: SceneDepthCube) => void;
  const capture = {
    capture: vi.fn(
      () =>
        new Promise<SceneDepthCube>((resolve) => {
          finish = resolve;
        }),
    ),
    dispose: vi.fn(),
  };
  const released = vi.fn(),
    scene = new Scene(),
    camera = new Camera();
  camera.position.set(10, 2, 3);
  camera.updateMatrixWorld();
  const lidar = new SceneDepthLidar(
    capture,
    { horizontalResolution: 4, verticalResolution: 1, verticalFovDegrees: 60 },
    released,
  );
  lidar.update(scene);
  expect(capture.capture).not.toHaveBeenCalled();
  lidar.setPose(camera);
  lidar.update(scene);
  lidar.update(scene);
  expect(capture.capture).toHaveBeenCalledOnce();
  camera.position.set(20, 2, 3);
  lidar.setPose(camera);
  finish({
    faces: Array.from({ length: 6 }, () => new Float32Array([2])),
    size: 1,
  });
  await vi.waitFor(() => expect(lidar.object.visible).toBe(true));
  const hit = new Matrix4();
  lidar.object.getMatrixAt(0, hit);
  expect(hit.elements[12]).toBeCloseTo(8); // Original pose, not the later 20m pose.
  expect(lidar.ranges.invalidValue).toBe(Infinity);
  expect(lidar.ranges.texture.image.width).toBe(4);
  expect(lidar.object.count).toBe(4);
  lidar.dispose();
  lidar.dispose();
  expect(capture.dispose).toHaveBeenCalledOnce();
  expect(released).toHaveBeenCalledOnce();
});
it("waits for an outstanding capture before releasing GPU resources and ignores its stale result", async () => {
  let finish!: (value: SceneDepthCube) => void;
  const capture = {
    capture: vi.fn(
      () =>
        new Promise<SceneDepthCube>((resolve) => {
          finish = resolve;
        }),
    ),
    dispose: vi.fn(),
  };
  const lidar = new SceneDepthLidar(capture, {
    horizontalResolution: 4,
    verticalResolution: 1,
    verticalFovDegrees: 60,
  });
  lidar.setPose(new Camera());
  lidar.update(new Scene());
  lidar.dispose();
  expect(capture.dispose).not.toHaveBeenCalled();
  finish({
    faces: Array.from({ length: 6 }, () => new Float32Array([2])),
    size: 1,
  });
  await vi.waitFor(() => expect(capture.dispose).toHaveBeenCalledOnce());
  expect(lidar.diagnostics.captures).toBe(0);
});

it("does not finish failed readback batches until sibling GPU copies have settled", async () => {
  const { settleDepthReadbacks } = await import("./settle-depth-readbacks");
  let finish!: (value: number) => void;
  const sibling = new Promise<number>((resolve) => {
    finish = resolve;
  });
  let rejected = false;
  const error = new Error("GPU readback failed");
  const batch = settleDepthReadbacks([Promise.reject(error), sibling]).catch(
    (reason) => {
      rejected = true;
      expect(reason).toBe(error);
    },
  );
  await Promise.resolve();
  await Promise.resolve();
  expect(rejected).toBe(false);
  finish(1);
  await batch;
  expect(rejected).toBe(true);
});

it("limits completed scans to 20 Hz with no extra 100 ms delay", async () => {
  const clock = vi.spyOn(performance, "now").mockReturnValue(0);
  const capture = {
    capture: vi.fn().mockResolvedValue({
      faces: Array.from({ length: 6 }, () => new Float32Array([2])),
      size: 1,
    }),
    dispose: vi.fn(),
  };
  const lidar = new SceneDepthLidar(capture, {
    horizontalResolution: 4,
    verticalResolution: 1,
    verticalFovDegrees: 60,
  });
  const scene = new Scene();
  try {
    lidar.setPose(new Camera());
    lidar.update(scene);
    await vi.waitFor(() => expect(lidar.diagnostics.captures).toBe(1));
    clock.mockReturnValue(49);
    lidar.update(scene);
    expect(capture.capture).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(50);
    lidar.update(scene);
    await vi.waitFor(() => expect(lidar.diagnostics.captures).toBe(2));
    clock.mockReturnValue(99);
    lidar.update(scene);
    expect(capture.capture).toHaveBeenCalledTimes(2);
    clock.mockReturnValue(100);
    lidar.update(scene);
    await vi.waitFor(() => expect(lidar.diagnostics.captures).toBe(3));
  } finally {
    lidar.dispose();
    clock.mockRestore();
  }
});
