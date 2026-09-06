import { OrbitControls } from "@react-three/drei";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { useCallback, useState } from "react";
import type { GaussianCloud as GaussianCloudObject } from "3dgs-tile-webgpu";

import type { Anchor, Vec3 } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { GaussianCloud } from "@/shared/three";
import type { ContextMenuPosition } from "@/shared/ui";

import { AnchorMarker } from "./anchor-marker";
import { frameCloud } from "./frame-cloud";
import { PlaybackCamera } from "./playback-camera";
import { TrajectoryLine } from "./trajectory-line";

interface SceneContentsProps {
  anchors: Anchor[];
  dark: boolean;
  onAddAnchor: (position: Vec3, normal: Vec3) => void;
  onCloudError: (error: Error) => void;
  onCloudLoading: () => void;
  onCloudReady: () => void;
  onOpenAnchorMenu: (anchor: Anchor, position: ContextMenuPosition) => void;
  onSelectTrajectory: () => void;
  pathPosition: number;
  selected: boolean;
  trajectory: CompiledTrajectory | null;
}

export function SceneContents({
  anchors,
  dark,
  onAddAnchor,
  onCloudError,
  onCloudLoading,
  onCloudReady,
  onOpenAnchorMenu,
  onSelectTrajectory,
  pathPosition,
  selected,
  trajectory,
}: SceneContentsProps) {
  const camera = useThree((state) => state.camera);
  const [orbitTarget, setOrbitTarget] = useState<Vec3>([0, 0, 0]);
  const handleCloudLoad = useCallback((cloud: GaussianCloudObject) => {
    frameCloud(camera, cloud, setOrbitTarget);
    onCloudReady();
  }, [camera, onCloudReady]);

  function handleCloudClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    const normal = event.face?.normal.clone().transformDirection(event.object.matrixWorld).normalize()
      ?? event.ray.direction.clone().negate().normalize();
    onAddAnchor(event.point.toArray() as Vec3, normal.toArray() as Vec3);
  }

  return (
    <>
      <GaussianCloud
        name="Mug Gaussian cloud"
        onClick={handleCloudClick}
        onError={onCloudError}
        onLoad={handleCloudLoad}
        onLoading={onCloudLoading}
        src="/mug.ply"
      />
      <ambientLight intensity={dark ? 0.8 : 1.25} />
      <directionalLight
        castShadow
        intensity={dark ? 1.7 : 2.1}
        position={[5, 8, 4]}
        shadow-mapSize={[1024, 1024]}
      />
      {anchors.map((anchor) => (
        <AnchorMarker anchor={anchor} key={anchor.id} onContextMenu={onOpenAnchorMenu} />
      ))}
      {trajectory && (
        <TrajectoryLine
          dark={dark}
          onSelect={onSelectTrajectory}
          selected={selected}
          trajectory={trajectory}
        />
      )}
      {trajectory && trajectory.position_segments.length > 0 && (
        <PlaybackCamera pathPosition={pathPosition} trajectory={trajectory} />
      )}
      <OrbitControls makeDefault maxDistance={Infinity} minDistance={0.001} target={orbitTarget} />
    </>
  );
}
