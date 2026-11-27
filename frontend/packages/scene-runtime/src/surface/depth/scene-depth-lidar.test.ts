import { Camera, Matrix4, Mesh, Scene, Texture } from "three";
import { expect, it, vi } from "vitest";
import { SceneDepthLidar } from "./scene-depth-lidar";
import type { SceneDepthGpuCube } from "./scene-depth-capture";
const cube: SceneDepthGpuCube = {
  faces: Array.from({ length: 6 }, () => new Texture()),
  size: 1,
  origin: "top-left",
};
function view() {
  return {
    object: new Mesh(),
    ranges: {
      texture: new Texture(),
      width: 4,
      height: 1,
      units: "meters" as const,
      format: "r32float" as const,
      invalidValue: 0,
    },
    draw: vi
      .fn<(_cube: SceneDepthGpuCube, _pose: Matrix4) => Promise<void>>()
      .mockResolvedValue(undefined),
    dispose: vi.fn(),
  };
}

it("shares pose snapshots and scheduling while never reading depth back or uploading instance matrices", async () => {
  let finish!: (value: SceneDepthGpuCube) => void;
  const capture = {
    render: vi.fn(
      () =>
        new Promise<SceneDepthGpuCube>((resolve) => {
          finish = resolve;
        }),
    ),
    capture: vi.fn(),
    dispose: vi.fn(),
  };
  const presentation = view(),
    released = vi.fn(),
    scene = new Scene(),
    camera = new Camera();
  camera.position.set(10, 2, 3);
  camera.updateMatrixWorld();
  const lidar = new SceneDepthLidar(capture, presentation, released);
  lidar.update(scene);
  expect(capture.render).not.toHaveBeenCalled();
  lidar.setPose(camera);
  lidar.update(scene);
  lidar.update(scene);
  expect(capture.render).toHaveBeenCalledOnce();
  camera.position.x = 20;
  lidar.setPose(camera);
  finish(cube);
  await vi.waitFor(() => expect(lidar.object.visible).toBe(true));
  expect(presentation.draw).toHaveBeenCalledOnce();
  expect(presentation.draw.mock.calls[0][0]).toBe(cube);
  expect((presentation.draw.mock.calls[0][1] as Matrix4).elements[12]).toBe(10);
  expect(capture.capture).not.toHaveBeenCalled();
  expect("instanceMatrix" in lidar.object).toBe(false);
  lidar.dispose();
  lidar.dispose();
  expect(capture.dispose).toHaveBeenCalledOnce();
  expect(presentation.dispose).toHaveBeenCalledOnce();
  expect(released).toHaveBeenCalledOnce();
});
it("waits for an outstanding capture and ignores its result after disposal", async () => {
  let finish!: (value: SceneDepthGpuCube) => void;
  const capture = {
      render: vi.fn(
        () =>
          new Promise<SceneDepthGpuCube>((resolve) => {
            finish = resolve;
          }),
      ),
      capture: vi.fn(),
      dispose: vi.fn(),
    },
    presentation = view();
  const lidar = new SceneDepthLidar(capture, presentation);
  lidar.setPose(new Camera());
  lidar.update(new Scene());
  lidar.dispose();
  expect(capture.dispose).not.toHaveBeenCalled();
  finish(cube);
  await vi.waitFor(() => expect(capture.dispose).toHaveBeenCalledOnce());
  expect(presentation.draw).not.toHaveBeenCalled();
  expect(lidar.diagnostics.captures).toBe(0);
});
it("limits completed GPU submissions to 20 Hz", async () => {
  const clock = vi.spyOn(performance, "now").mockReturnValue(0),
    capture = {
      render: vi.fn().mockResolvedValue(cube),
      capture: vi.fn(),
      dispose: vi.fn(),
    },
    lidar = new SceneDepthLidar(capture, view()),
    scene = new Scene();
  try {
    lidar.setPose(new Camera());
    lidar.update(scene);
    await vi.waitFor(() => expect(lidar.diagnostics.captures).toBe(1));
    clock.mockReturnValue(49);
    lidar.update(scene);
    expect(capture.render).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(50);
    lidar.update(scene);
    await vi.waitFor(() => expect(lidar.diagnostics.captures).toBe(2));
    clock.mockReturnValue(99);
    lidar.update(scene);
    expect(capture.render).toHaveBeenCalledTimes(2);
    clock.mockReturnValue(100);
    lidar.update(scene);
    await vi.waitFor(() => expect(lidar.diagnostics.captures).toBe(3));
  } finally {
    lidar.dispose();
    clock.mockRestore();
  }
});
it("keeps export readback resources alive until sibling copies settle", async () => {
  const { settleDepthReadbacks } = await import("./settle-depth-readbacks");
  let finish!: (n: number) => void;
  const sibling = new Promise<number>((resolve) => {
    finish = resolve;
  });
  let rejected = false;
  const batch = settleDepthReadbacks([
    Promise.reject(new Error("read failed")),
    sibling,
  ]).catch(() => {
    rejected = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(rejected).toBe(false);
  finish(1);
  await batch;
  expect(rejected).toBe(true);
});

it("does not enqueue another scan or dispose targets until the GPU completion fence resolves", async () => {
  const clock = vi.spyOn(performance, "now").mockReturnValue(0);
  let complete!: () => void;
  const presentation = view();
  presentation.draw.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const capture = {
      render: vi.fn().mockResolvedValue(cube),
      capture: vi.fn(),
      dispose: vi.fn(),
    },
    lidar = new SceneDepthLidar(capture, presentation),
    scene = new Scene();
  try {
    lidar.setPose(new Camera());
    lidar.update(scene);
    await vi.waitFor(() => expect(presentation.draw).toHaveBeenCalledOnce());
    clock.mockReturnValue(500);
    lidar.update(scene);
    expect(capture.render).toHaveBeenCalledOnce();
    lidar.dispose();
    expect(presentation.dispose).not.toHaveBeenCalled();
    expect(capture.dispose).not.toHaveBeenCalled();
    complete();
    await vi.waitFor(() => expect(presentation.dispose).toHaveBeenCalledOnce());
    expect(capture.dispose).toHaveBeenCalledOnce();
  } finally {
    clock.mockRestore();
  }
});
