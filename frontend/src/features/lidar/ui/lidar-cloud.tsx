import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Camera } from "three";
import type { LidarKeyframe } from "@/shared/api/generated/model";
import type { GaussianRenderingBackend } from "@/shared/scene-surface/model/gaussian-rendering-backend";
import type { GaussianLidarInstance } from "@/shared/scene-surface/model/gaussian-lidar";
import {
  evaluateTrajectoryCameraPose,
  type CompiledTrajectory,
} from "@/entities/trajectory";

interface LidarCloudProps {
  backend: GaussianRenderingBackend;
  settings: LidarKeyframe;
  trajectory: CompiledTrajectory;
  pathPosition: number;
}

export function LidarCloud({
  backend,
  settings,
  trajectory,
  pathPosition,
}: LidarCloudProps) {
  const scene = useThree((state) => state.scene);
  const resources = useRef<{
    sensor: GaussianLidarInstance;
    camera: Camera;
  } | null>(null);
  const {
    vertical_fov_deg = 60,
    horizontal_resolution = 512,
    vertical_resolution = 32,
  } = settings;
  useEffect(() => {
    if (!backend.createLidar) return;
    const sensor = backend.createLidar({
      verticalFovDegrees: vertical_fov_deg,
      horizontalResolution: horizontal_resolution,
      verticalResolution: vertical_resolution,
    });
    const camera = new Camera();
    resources.current = { sensor, camera };
    scene.add(sensor.object);
    return () => {
      resources.current = null;
      scene.remove(sensor.object);
      sensor.dispose();
    };
  }, [
    backend,
    scene,
    vertical_fov_deg,
    horizontal_resolution,
    vertical_resolution,
  ]);
  useFrame(() => {
    const current = resources.current;
    if (!current) return;
    const pose = evaluateTrajectoryCameraPose(trajectory, pathPosition);
    current.camera.position.copy(pose.position);
    current.camera.quaternion.copy(pose.quaternion);
    current.camera.up.copy(pose.up);
    current.camera.updateMatrixWorld();
    current.sensor.setPose(current.camera);
  }, -0.5);
  return null;
}
