"use client";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { OrbitControls } from "@react-three/drei";
import {
  compiledTrajectory,
  playbackState,
  editorTool,
} from "@camera-path/contracts/host-data";
import { useData, useDataQuery } from "@camera-path/extension-api";
import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";
import { useEffect, useRef } from "react";
import { manifest } from "../manifest";
import { useCameraMode } from "../ports";
import { useStopOrbitControlsInertia } from "./use-stop-orbit-controls-inertia";
import { PlaybackCamera } from "./playback-camera";
import { TrajectoryCameraControl } from "./trajectory-camera-control";
import { CameraViewOffset } from "./camera-view-offset";
export function SceneExtension() {
  const trajectory = useDataQuery(manifest, compiledTrajectory).data?.data;
  const playback = useData(manifest, playbackState);
  const tool = useData(manifest, editorTool).activeTool;
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
