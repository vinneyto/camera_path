"use client";
import { gaussianScene } from "@camera-path/contracts/gpu-resources";
import { GpuProvider } from "@camera-path/extension-api/gpu-provider";
import { GpuRegistry } from "@camera-path/extension-api/gpu-registry";
import type { GaussianRenderingBackend } from "@camera-path/scene-runtime/surface";
import { useOptionalRenderPipeline } from "@camera-path/scene-runtime/three";

import { trajectoryCameraPose } from "@camera-path/contracts/host-data";
import { DataCell } from "@camera-path/extension-api/data-cell";
import { FrameProvider } from "@camera-path/extension-api/frame-provider";
import { FrameRegistry } from "@camera-path/extension-api/frame-registry";
import { useHostRuntime } from "@camera-path/extension-api/host-provider";
import {
  evaluateTrajectoryCameraPose,
  type CompiledTrajectory,
} from "@camera-path/trajectory-math";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
export function SceneFrameProvider({
  trajectory,
  pathPosition,
  backend,
  children,
}: {
  trajectory: CompiledTrajectory | null;
  pathPosition: number;
  backend: GaussianRenderingBackend;
  children: ReactNode;
}) {
  const [gpu] = useState(() => {
    const g = new GpuRegistry();
    g.publish(
      gaussianScene,
      "host",
      {
        available: !!backend.createLidar,
        createSensor: (settings) => {
          if (!backend.createLidar)
            throw new Error("LiDAR unavailable on this renderer");
          return backend.createLidar(settings);
        },
      },
      true,
    );
    return g;
  });
  const pipeline = useOptionalRenderPipeline();
  const runtime = useHostRuntime();
  const [registry] = useState(() => new FrameRegistry());
  const [cell] = useState(() => {
    const c = new DataCell(trajectoryCameraPose);
    c.set(null);
    return c;
  });
  useLayoutEffect(
    () => runtime.bindData(trajectoryCameraPose, cell.read, cell.subscribe),
    [runtime, cell],
  );
  useLayoutEffect(
    () =>
      registry.register(
        { id: "host.trajectoryCamera.update", phase: "update" },
        ({ frameId }) => {
          if (!trajectory || !trajectory.position_segments.length) {
            cell.set(null);
            return;
          }
          const pose = evaluateTrajectoryCameraPose(trajectory, pathPosition);
          cell.set({
            position: pose.position.toArray() as [number, number, number],
            orientation: pose.quaternion.toArray() as [
              number,
              number,
              number,
              number,
            ],
            up: pose.up.toArray() as [number, number, number],
            frameId,
            projectRevision: trajectory.revision,
          });
        },
      ),
    [registry, cell, trajectory, pathPosition],
  );

  const gpuLifetime = useRef(0);
  useLayoutEffect(() => {
    const lifetime = gpuLifetime;
    lifetime.current++;
    return () => {
      const ticket = ++lifetime.current;
      queueMicrotask(() => {
        if (lifetime.current === ticket) gpu.clear();
      });
    };
  }, [gpu]);
  const clock = useRef({ frameId: 0, deltaSeconds: 0, elapsedSeconds: 0 });
  useFrame(({ clock: r3fClock }, delta) => {
    const context = {
      frameId: ++clock.current.frameId,
      deltaSeconds: delta,
      elapsedSeconds: r3fClock.elapsedTime,
    };
    clock.current = context;
    registry.run("update", context);
    registry.run("before-render", context);
  }, -2);
  useLayoutEffect(
    () =>
      pipeline?.registerAfterRender?.(() =>
        registry.run("after-render", clock.current),
      ),
    [pipeline, registry, clock],
  );
  return (
    <FrameProvider registry={registry}>
      <GpuProvider registry={gpu}>{children}</GpuProvider>
    </FrameProvider>
  );
}
