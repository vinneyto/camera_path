// @vitest-environment happy-dom
import { StrictMode } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Object3D, Quaternion, Scene, Vector3, type Camera } from "three";
import type { GaussianRenderingBackend } from "@/shared/scene-surface/model/gaussian-rendering-backend";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { LidarCloud } from "./lidar-cloud";

const state = vi.hoisted(() => ({
  scene: null as unknown,
  frame: () => {},
  pose: null as unknown,
}));
vi.mock("@react-three/fiber", () => ({
  useThree: (selector: (value: unknown) => unknown) =>
    selector({ scene: state.scene }),
  useFrame: (callback: () => void) => {
    state.frame = callback;
  },
}));
vi.mock("@/entities/trajectory", () => ({
  evaluateTrajectoryCameraPose: () => state.pose,
}));
afterEach(() => vi.clearAllMocks());

it("uses the trajectory pose independently of the viewing camera and releases changed/removed sensors", () => {
  state.scene = new Scene();
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.75);
  state.pose = {
    position: new Vector3(10, 2, 3),
    quaternion: q,
    up: new Vector3(0, 1, 0),
  };
  const sensors: Array<{
    object: Object3D;
    dispose: ReturnType<typeof vi.fn>;
    setPose: ReturnType<typeof vi.fn>;
  }> = [];
  const createLidar = vi.fn(() => {
    const sensor = {
      object: new Object3D(),
      dispose: vi.fn(),
      setPose: vi.fn(),
    };
    sensors.push(sensor);
    return sensor;
  });
  const backend = { createLidar } as unknown as GaussianRenderingBackend;
  const trajectory = {} as CompiledTrajectory;
  const props = { backend, trajectory, pathPosition: 0.5 };
  const view = render(
    <StrictMode>
      <LidarCloud
        {...props}
        settings={{
          vertical_fov_deg: 60,
          horizontal_resolution: 512,
          vertical_resolution: 32,
        }}
      />
    </StrictMode>,
  );
  expect(sensors[0].dispose).toHaveBeenCalledOnce(); // Strict Mode replay owns a fresh sensor.
  act(() => state.frame());
  const camera = sensors[1].setPose.mock.calls[0][0] as Camera;
  expect(camera.position.toArray()).toEqual([10, 2, 3]);
  expect(camera.quaternion.toArray()).toEqual(q.toArray());
  expect((state.scene as Scene).children).toEqual([sensors[1].object]);
  // Both orbit and camera playback use this same component; only path position drives pose.
  view.rerender(
    <StrictMode>
      <LidarCloud
        {...props}
        pathPosition={0.9}
        settings={{
          vertical_fov_deg: 90,
          horizontal_resolution: 1024,
          vertical_resolution: 64,
        }}
      />
    </StrictMode>,
  );
  expect(sensors[1].dispose).toHaveBeenCalledOnce();
  expect(createLidar).toHaveBeenLastCalledWith({
    verticalFovDegrees: 90,
    horizontalResolution: 1024,
    verticalResolution: 64,
  });
  act(() => state.frame());
  expect(sensors[2].setPose).toHaveBeenCalledOnce();
  view.unmount();
  expect(sensors[2].dispose).toHaveBeenCalledOnce();
  expect((state.scene as Scene).children).toEqual([]);
});
