import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { type Group } from "three";

import { evaluateTrajectoryCameraPose, type CompiledTrajectory } from "@/entities/trajectory";

import { PLAYBACK_CAMERA_FRUSTUM } from "../lib/create-playback-camera-frustum";
import { PlaybackCameraHelperGroup } from "./playback-camera-helper-group";

interface PlaybackCameraProps {
  pathPosition: number;
  trajectory: CompiledTrajectory;
}

export function PlaybackCamera({ pathPosition, trajectory }: PlaybackCameraProps) {
  const helperRef = useRef<Group>(null);

  useFrame(() => {
    const helper = helperRef.current;
    if (helper === null) return;

    const pose = evaluateTrajectoryCameraPose(trajectory, pathPosition);
    helper.position.copy(pose.position);
    helper.quaternion.copy(pose.quaternion);
    helper.updateMatrixWorld();
  });

  return (
    <group ref={helperRef}>
      {PLAYBACK_CAMERA_FRUSTUM.groups.map((group) => (
        <PlaybackCameraHelperGroup group={group} key={group.color} />
      ))}
    </group>
  );
}
