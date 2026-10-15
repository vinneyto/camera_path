"use client";
import { useCompiledTrajectoryQuery } from "@camera-path/api/project";
import { useUserSettings } from "@camera-path/api/settings";
import { AnchorsScene } from "@camera-path/feature-anchors";
import { CameraViewScene } from "@camera-path/feature-camera-view";
import { DepthOfFieldScene } from "@camera-path/feature-depth-of-field";
import { LidarScene } from "@camera-path/feature-lidar";
import { SceneGrid } from "@camera-path/feature-scene-grid";
import { SceneModels } from "@camera-path/feature-scene-models";
import { TrajectoryScene } from "@camera-path/feature-trajectory";
import {
  SceneSurfaceProvider,
  useGaussianRenderingBackend,
  type SceneSurfaceBackground,
  type SceneSurfaceReady,
} from "@camera-path/scene-runtime/surface";
import { DEPTH_OF_FIELD_AUTOFOCUS_LAYER } from "@camera-path/scene-runtime/three";
import { SceneServicesProvider } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { TrajectoryPoseProvider } from "@camera-path/scene-runtime/viewport/trajectory-pose-provider";
import { useEditorStore, useProjectId } from "@camera-path/store";
import type { Vec3 } from "@camera-path/types/project";
import { useThree } from "@react-three/fiber";
import { useState } from "react";
import { frameSurface } from "./frame-surface";
const PICK_LAYERS = [DEPTH_OF_FIELD_AUTOFOCUS_LAYER] as const;
export function SceneContents({
  background,
  dark,
  bottomInset = 0,
  depthSupported = false,
}: {
  background: SceneSurfaceBackground;
  dark: boolean;
  bottomInset?: number;
  depthSupported?: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const { gaussianDpr } = useUserSettings();
  const interactive = useEditorStore((s) => s.camera.cameraMode === "orbit");
  const query = useCompiledTrajectoryQuery(useProjectId());
  const trajectory = query.data ?? null;
  const [orbitTarget, setOrbitTarget] = useState<Vec3>([0, 0, 0]);
  const [bounds, setBounds] = useState<
    Record<string, SceneSurfaceReady["bounds"]>
  >({});
  const [depthRequests, setDepthRequests] = useState<Record<string, boolean>>(
    {},
  );
  // Services are imperative registrations: stable identity prevents teardown on frame updates.
  const [reportBounds] = useState(
    () => (id: string, value: SceneSurfaceReady["bounds"] | null) =>
      setBounds((previous) => {
        const next = { ...previous };
        if (value) next[id] = value;
        else delete next[id];
        return next;
      }),
  );
  const [requestDepth] = useState(
    () => (id: string, enabled: boolean) =>
      setDepthRequests((previous) =>
        previous[id] === enabled ? previous : { ...previous, [id]: enabled },
      ),
  );
  const backend = useGaussianRenderingBackend(
    background,
    gaussianDpr,
    depthSupported && Object.values(depthRequests).some(Boolean),
    PICK_LAYERS,
  );
  const radius = Object.values(bounds).length
    ? Math.max(...Object.values(bounds).map((b) => b.radius))
    : null;
  return (
    <SceneSurfaceProvider backend={backend}>
      <SceneServicesProvider
        value={{
          backend,
          dark,
          interactive,
          bottomInset,
          depthSupported,
          radius,
          orbitTarget,
          setOrbitTarget,
          reportBounds,
          requestDepth,
          frame: (bounds) => frameSurface(camera, bounds, setOrbitTarget),
        }}
      >
        <TrajectoryPoseProvider trajectory={trajectory}>
          <CameraViewScene />
          <SceneGrid />
          <SceneModels />
          <AnchorsScene />
          <TrajectoryScene />
          <DepthOfFieldScene />
          <LidarScene />
          <ambientLight intensity={dark ? 0.8 : 1.25} />
          <directionalLight
            castShadow
            intensity={dark ? 1.7 : 2.1}
            position={[5, 8, 4]}
            shadow-mapSize={[1024, 1024]}
          />
        </TrajectoryPoseProvider>
      </SceneServicesProvider>
    </SceneSurfaceProvider>
  );
}
