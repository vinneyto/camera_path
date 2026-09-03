"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import type { Anchor, Vec3 } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";

import { AnchorMarker } from "./anchor-marker";
import { PlaybackCamera } from "./playback-camera";
import { SimpleScene } from "./simple-scene";
import { TrajectoryLine } from "./trajectory-line";

interface SceneCanvasProps {
  anchors: Anchor[];
  pathPosition: number;
  selected: boolean;
  trajectory: CompiledTrajectory | null;
  onAddAnchor: (position: Vec3, normal: Vec3) => void;
  onSelectTrajectory: () => void;
}

export function SceneCanvas({
  anchors,
  pathPosition,
  selected,
  trajectory,
  onAddAnchor,
  onSelectTrajectory,
}: SceneCanvasProps) {
  return (
    <Canvas
      camera={{ far: 100, fov: 42, near: 0.05, position: [7, 6, 8] }}
      dpr={[1, 2]}
      shadows
    >
      <color args={["#ebe9e5"]} attach="background" />
      <ambientLight intensity={1.25} />
      <directionalLight castShadow intensity={2.1} position={[5, 8, 4]} shadow-mapSize={[1024, 1024]} />
      <SimpleScene onSurfaceClick={onAddAnchor} />
      {anchors.map((anchor) => <AnchorMarker anchor={anchor} key={anchor.id} />)}
      {trajectory && (
        <TrajectoryLine
          onSelect={onSelectTrajectory}
          selected={selected}
          trajectory={trajectory}
        />
      )}
      {trajectory && trajectory.position_segments.length > 0 && (
        <PlaybackCamera pathPosition={pathPosition} trajectory={trajectory} />
      )}
      <OrbitControls makeDefault maxDistance={18} minDistance={2.5} target={[0, 0.7, 0]} />
    </Canvas>
  );
}
