"use client";
import { Slot } from "@camera-path/slots";

import { useCompiledTrajectoryQuery } from "@camera-path/api/project";
import { useUserSettings } from "@camera-path/store";
import {
  SceneSurfaceProvider,
  useGaussianRenderingBackend,
  type SceneSurfaceBackground,
  type SceneSurfaceReady,
} from "@camera-path/scene-runtime/surface";
import { DEPTH_OF_FIELD_AUTOFOCUS_LAYER } from "@camera-path/render-pipeline";
import { SceneServicesProvider } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { TrajectoryPoseProvider } from "@camera-path/scene-runtime/viewport/trajectory-pose-provider";
import { useCameraState, useProjectId } from "@camera-path/store";
import type { Vec3 } from "@camera-path/types/project";
import { useThree } from "@react-three/fiber";
import { useState } from "react";
import { frameSurface } from "./frame-surface";
import { SceneHoverEffect } from "./scene-hover-effect";
import { SceneSelectEffect } from "./scene-select-effect";
import {
  SCENE_DIRECTIONAL_LIGHT_POSITION,
  SCENE_SHADOW_MAP_SIZE,
} from "../constants";
import { selectSceneLighting } from "../selectors/select-scene-lighting";
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
  const lighting = selectSceneLighting(dark);
  const { gaussianDpr } = useUserSettings();
  const interactive = useCameraState().cameraMode === "orbit";
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
          <SceneHoverEffect />
          <SceneSelectEffect />
          <Slot name="project.scene" />
          <ambientLight intensity={lighting.ambient} />
          <directionalLight
            castShadow
            intensity={lighting.directional}
            position={SCENE_DIRECTIONAL_LIGHT_POSITION}
            shadow-mapSize={SCENE_SHADOW_MAP_SIZE}
          />
        </TrajectoryPoseProvider>
      </SceneServicesProvider>
    </SceneSurfaceProvider>
  );
}
