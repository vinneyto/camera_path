"use client";
import type { LidarKeyframe } from "@camera-path/contracts/api";
import {
  gaussianScene,
  lidarHitInstances,
  lidarRanges,
} from "@camera-path/contracts/gpu-resources";
import { trajectoryCameraPose } from "@camera-path/contracts/host-data";
import {
  useFeatureGpu,
  useFeatureHost,
  useHostFrame,
} from "@camera-path/extension-api";
import type { GaussianLidarInstance } from "@camera-path/scene-runtime/surface/model/gaussian-lidar";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Camera } from "three";
import { manifest } from "../manifest";

interface LidarCloudProps {
  settings: LidarKeyframe;
}

export function LidarCloud({ settings }: LidarCloudProps) {
  const gpu = useFeatureGpu(manifest);
  const host = useFeatureHost(manifest);
  const scene = useThree((state) => state.scene);
  const resources = useRef<{
    sensor: GaussianLidarInstance;
    camera: Camera;
    reportedReady: boolean;
    ranges: { ready: () => void; dispose: () => void } | null;
    hits: { ready: () => void; dispose: () => void } | null;
  } | null>(null);
  const {
    vertical_fov_deg = 60,
    horizontal_resolution = 512,
    vertical_resolution = 32,
  } = settings;
  useEffect(() => {
    const lease = gpu.lease(gaussianScene);
    if (!lease.ready) return;
    if (!lease.read().available) return;
    const sensor = lease.read().createSensor({
      verticalFovDegrees: vertical_fov_deg,
      horizontalResolution: horizontal_resolution,
      verticalResolution: vertical_resolution,
    });
    const camera = new Camera();
    const ranges = sensor.ranges
      ? gpu.publish(lidarRanges, sensor.ranges)
      : null;
    const hits = sensor.hits
      ? gpu.publish(lidarHitInstances, sensor.hits)
      : null;
    resources.current = { sensor, camera, ranges, hits, reportedReady: false };
    scene.add(sensor.object);

    return () => {
      resources.current = null;
      scene.remove(sensor.object);
      ranges?.dispose();
      hits?.dispose();
      sensor.dispose();
    };
  }, [
    gpu,
    scene,
    vertical_fov_deg,
    horizontal_resolution,
    vertical_resolution,
  ]);
  useHostFrame(manifest, "lidar.update", () => {
    const current = resources.current;
    if (!current) return;
    const pose = host.data.read(trajectoryCameraPose);
    if (!pose) return;
    current.camera.position.fromArray(pose.position);
    current.camera.quaternion.fromArray(pose.orientation);
    current.camera.up.fromArray(pose.up);
    current.camera.updateMatrixWorld();
    current.sensor.setPose(current.camera);
  });
  useHostFrame(manifest, "lidar.outputs", () => {
    const current = resources.current;
    if (current?.sensor.object.visible && !current.reportedReady) {
      current.ranges?.ready();
      current.hits?.ready();
      current.reportedReady = true;
    }
  });

  return null;
}
