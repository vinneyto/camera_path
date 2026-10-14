"use client";
import { useHostRuntime } from "@camera-path/extension-api/host-provider";
import { ExtensionSlot } from "@camera-path/extension-api";
import {
  SceneSurfaceProvider,
  useGaussianRenderingBackend,
  type SceneSurfaceBackground,
  type SceneSurfaceReady,
} from "@camera-path/scene-runtime/surface";
import { SceneServicesProvider } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { DEPTH_OF_FIELD_AUTOFOCUS_LAYER } from "@camera-path/scene-runtime/three";
import { useThree } from "@react-three/fiber";
import { useState } from "react";
import type { Vec3 } from "@camera-path/contracts/project";
import { useUserSettings } from "@host/adapters/settings";
import { useCompiledTrajectoryQuery } from "@host/adapters/project";
import { useEditorStore } from "@host/editor/model/editor-store-provider";
import { SceneFrameProvider } from "@host/runtime/scene-frame-provider";
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
  const pathPosition = useEditorStore((s) => s.playback.pathPosition);
  const query = useCompiledTrajectoryQuery(useHostRuntime().scopeId);
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
        <SceneFrameProvider
          backend={backend}
          trajectory={trajectory}
          pathPosition={pathPosition}
        >
          <ExtensionSlot name="scene.root" />
          <ambientLight intensity={dark ? 0.8 : 1.25} />
          <directionalLight
            castShadow
            intensity={dark ? 1.7 : 2.1}
            position={[5, 8, 4]}
            shadow-mapSize={[1024, 1024]}
          />
        </SceneFrameProvider>
      </SceneServicesProvider>
    </SceneSurfaceProvider>
  );
}
