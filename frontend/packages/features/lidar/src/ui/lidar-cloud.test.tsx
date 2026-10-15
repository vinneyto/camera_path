// @vitest-environment happy-dom
import { LidarCloud } from "@camera-path/feature-lidar/ui/lidar-cloud";
import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { Object3D, Quaternion, Scene, Vector3, type Camera } from "three";
import { afterEach, expect, it, vi } from "vitest";

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
const gpu = vi.hoisted(() => ({ createSensor: null as unknown }));
vi.mock("@camera-path/scene-runtime/viewport/scene-services-provider", () => ({
  useSceneServices: () => ({ backend: { createLidar: gpu.createSensor } }),
}));
vi.mock("@camera-path/scene-runtime/viewport/trajectory-pose-provider", () => ({
  useTrajectoryPose: () => ({ current: state.pose }),
}));
afterEach(() => vi.clearAllMocks());

it("uses the trajectory pose independently of the viewing camera and releases changed/removed sensors", () => {
  state.scene = new Scene();
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.75);
  state.pose = {
    position: [10, 2, 3],
    orientation: q.toArray(),
    up: [0, 1, 0],
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
  gpu.createSensor = createLidar;
  const props = {};
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
