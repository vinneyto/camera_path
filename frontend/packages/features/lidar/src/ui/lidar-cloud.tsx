"use client";
import type { GaussianLidarInstance } from "@camera-path/scene-runtime/surface/model/gaussian-lidar";
import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { useTrajectoryPose } from "@camera-path/scene-runtime/viewport/trajectory-pose-provider";
import type { LidarKeyframe } from "@camera-path/types/api";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Camera } from "three";
export function LidarCloud({ settings }: { settings: LidarKeyframe }) {
  const { backend } = useSceneServices();
  const pose = useTrajectoryPose();
  const scene = useThree((s) => s.scene);
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
    resources.current = { sensor, camera: new Camera() };
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
    const value = pose.current,
      current = resources.current;
    if (!value || !current) return;
    current.camera.position.fromArray(value.position);
    current.camera.quaternion.fromArray(value.orientation);
    current.camera.up.fromArray(value.up);
    current.camera.updateMatrixWorld();
    current.sensor.setPose(current.camera);
  }, -1);
  return null;
}
