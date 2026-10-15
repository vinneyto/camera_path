"use client";
import { useCompiledTrajectoryResource } from "@camera-path/api/resources";
import { useEditorTool, usePlaybackState } from "@camera-path/store";

import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useCameraMode } from "../ports";
import { CameraViewOffset } from "./camera-view-offset";
import { PlaybackCamera } from "./playback-camera";
import { TrajectoryCameraControl } from "./trajectory-camera-control";
import { useStopOrbitControlsInertia } from "./use-stop-orbit-controls-inertia";
export function CameraViewScene() {
  const trajectory = useCompiledTrajectoryResource().data?.data;
  const playback = usePlaybackState();
  const tool = useEditorTool().activeTool;
  const { cameraMode, setCameraMode } = useCameraMode();
  const services = useSceneServices();
  const controls = useRef<OrbitControlsImpl>(null);
  const viewport = useViewportServices();
  const available = Boolean(trajectory?.position_segments.length);
  useEffect(() => {
    if (cameraMode !== "orbit") viewport.closeMenu();
  }, [cameraMode, viewport]);
  useStopOrbitControlsInertia(
    controls,
    cameraMode === "orbit" && tool !== null,
  );
  useEffect(() => {
    if (cameraMode === "trajectory" && !available) setCameraMode("orbit");
  }, [cameraMode, available, setCameraMode]);
  return (
    <>
      <CameraViewOffset bottomInset={services.bottomInset} />
      {cameraMode === "orbit" ? (
        <>
          {available && trajectory && (
            <PlaybackCamera
              trajectory={trajectory}
              pathPosition={playback.pathPosition}
            />
          )}
          <OrbitControls
            enabled={tool === null}
            makeDefault
            maxDistance={Infinity}
            minDistance={0.001}
            ref={controls}
            target={services.orbitTarget}
            onChange={() => viewport.events.emit("controlsChange", undefined)}
            onStart={() => viewport.events.emit("controlsStart", undefined)}
            onEnd={() => {
              if (controls.current)
                services.setOrbitTarget(
                  controls.current.target.toArray() as [number, number, number],
                );
            }}
          />
        </>
      ) : (
        available && <TrajectoryCameraControl />
      )}
    </>
  );
}
