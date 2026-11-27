// @vitest-environment happy-dom
import { createEditorStore, EditorStoreProvider } from "@camera-path/store";
import {
  createEditorActions,
  EditorActionsProvider,
} from "@camera-path/actions";
import {
  SceneServicesProvider,
  type SceneServices,
} from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { TrajectoryPoseProvider } from "@camera-path/scene-runtime/viewport/trajectory-pose-provider";
import { SceneEvents } from "@camera-path/scene-runtime/viewport/scene-events";
import type { CompiledTrajectory } from "@camera-path/types/trajectory";
import type { Vec3 } from "@camera-path/types/project";
import { createRoot, extend, type RootState } from "@react-three/fiber";
import { act, StrictMode, useState } from "react";
import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import { CameraViewScene } from "./scene";

vi.mock("@camera-path/api/resources", () => ({
  useCompiledTrajectoryResource: () => ({ data: { data: trajectory } }),
}));
vi.mock("@camera-path/scene-runtime/viewport/viewport-provider", () => ({
  useViewportServices: () => viewport,
}));
const viewport = { events: new SceneEvents(), closeMenu: vi.fn() };
const trajectory: CompiledTrajectory = {
  project_id: "project",
  revision: 1,
  total_length: 1,
  duration_seconds: 1,
  position_segments: [
    {
      source_segment_id: "segment",
      p0: [0, 0, 0],
      p1: [1 / 3, 0, 0],
      p2: [2 / 3, 0, 0],
      p3: [1, 0, 0],
      length: 1,
    },
  ],
  arc_length_table: [
    { segment_index: 0, t: 0, distance: 0 },
    { segment_index: 0, t: 1, distance: 1 },
  ],
  motion_profile: { default_speed: 1, keyframes: [] },
  camera_track: {
    depth_of_field_keyframes: [],
    keyframes: [],
    orientation_keyframes: [],
    default_aim: { kind: "follow_path", direction: "forward" },
    default_orientation: { yaw_deg: 0, pitch_deg: 0, roll_deg: 0 },
    world_up: [0, 1, 0],
  },
  warnings: [],
};
afterEach(() => vi.unstubAllGlobals());

it("switches real R3F camera controls without jumps, retains flight after trajectory view and cleans up in Strict Mode", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  extend({
    Group: THREE.Group,
    Mesh: THREE.Mesh,
    CylinderGeometry: THREE.CylinderGeometry,
    MeshStandardMaterial: THREE.MeshStandardMaterial,
  });
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  canvas.setPointerCapture = vi.fn();
  canvas.hasPointerCapture = vi.fn(() => false);
  canvas.releasePointerCapture = vi.fn();
  const store = createEditorStore();
  const actions = createEditorActions(store);
  const camera = new THREE.PerspectiveCamera(42, 1.5, 0.03, 240);
  camera.position.set(4, 5, 6);
  camera.lookAt(0, 0, 0);
  const root = createRoot(canvas);
  let runtime!: RootState;
  await root.configure({
    camera,
    onCreated: (state) => {
      runtime = state;
    },
    frameloop: "never",
    size: { width: 600, height: 400, top: 0, left: 0 },
    gl: {
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      domElement: canvas,
    } as unknown as THREE.WebGLRenderer,
  });
  function Scene() {
    const [orbitTarget, setOrbitTarget] = useState<Vec3>([0, 0, 0]);
    return (
      <SceneServicesProvider
        value={{ orbitTarget, setOrbitTarget, bottomInset: 0 } as SceneServices}
      >
        <TrajectoryPoseProvider trajectory={trajectory}>
          <CameraViewScene />
        </TrajectoryPoseProvider>
      </SceneServicesProvider>
    );
  }
  await act(async () => {
    root.render(
      <StrictMode>
        <EditorStoreProvider store={store}>
          <EditorActionsProvider actions={actions}>
            <Scene />
          </EditorActionsProvider>
        </EditorStoreProvider>
      </StrictMode>,
    );
  });
  // Advance drives the real useFrame subscribers, including OrbitControls.
  let timestamp = 0;
  const frame = () => runtime.advance((timestamp += 0.016));
  try {
    const orbitControls = runtime.get().controls as unknown as {
      enabled: boolean;
    };
    expect(orbitControls.enabled).toBe(true);
    await act(async () => actions.setCameraType("freeFlight"));
    expect(orbitControls.enabled).toBe(false);
    expect(camera.far).toBe(100);
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    frame();
    frame();
    canvas.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
    const position = camera.position.clone();
    const orientation = camera.quaternion.clone();
    camera.far = 1000; // Model framing must not override the flight frustum.
    frame();
    expect(camera.far).toBe(100);
    expect(position.distanceTo(new THREE.Vector3(4, 5, 6))).toBeGreaterThan(0);
    await act(async () => actions.setCameraType("orbit"));
    frame();
    expect(orbitControls.enabled).toBe(true);
    expect(camera.position.distanceTo(position)).toBeLessThan(1e-7);
    expect(camera.quaternion.angleTo(orientation)).toBeLessThan(1e-7);
    expect(camera.far).toBe(240);
    expect(camera.fov).toBe(42);
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
    // Orbit is the sole wheel handler now (its damping is advanced below).
    frame();
    await act(async () => actions.setCameraType("freeFlight"));
    const flightPosition = camera.position.clone();
    await act(async () => actions.setCameraMode("trajectory"));
    frame();
    expect(camera.position.distanceTo(new THREE.Vector3(0, 0, 0))).toBeLessThan(
      1e-7,
    );
    expect(orbitControls.enabled).toBe(false);
    await act(async () => actions.setCameraMode("orbit"));
    frame();
    expect(store.getState().camera.cameraType).toBe("freeFlight");
    expect(camera.position.distanceTo(flightPosition)).toBeLessThan(1e-7);
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    await act(async () => actions.setActiveTool("anchor"));
    const stopped = camera.position.clone();
    frame();
    expect(camera.position.equals(stopped)).toBe(true);
    await act(async () => actions.setActiveTool(null));
    frame();
    expect(camera.position.equals(stopped)).toBe(true);
  } finally {
    await act(async () => root.unmount());
    canvas.remove();
  }
});
