"use client";
import { useEditorStoreApi } from "@camera-path/store";
import {
  evaluateTrajectoryCameraPose,
  type CompiledTrajectory,
} from "@camera-path/trajectory-math";
import { useFrame } from "@react-three/fiber";
import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
export interface TrajectoryPose {
  position: [number, number, number];
  orientation: [number, number, number, number];
  up: [number, number, number];
}
const Context = createContext<RefObject<TrajectoryPose | null> | null>(null);
export function TrajectoryPoseProvider({
  trajectory,
  children,
}: {
  trajectory: CompiledTrajectory | null;
  children: ReactNode;
}) {
  const store = useEditorStoreApi();
  const pose = useRef<TrajectoryPose | null>(null);
  useFrame(() => {
    if (!trajectory?.position_segments.length) {
      pose.current = null;
      return;
    }
    const value = evaluateTrajectoryCameraPose(
      trajectory,
      store.getState().playback.pathPosition,
    );
    pose.current = {
      position: value.position.toArray(),
      orientation: value.quaternion.toArray(),
      up: value.up.toArray(),
    };
  }, -2);
  return <Context.Provider value={pose}>{children}</Context.Provider>;
}
export function useTrajectoryPose() {
  const pose = useContext(Context);
  if (!pose) throw new Error("TrajectoryPoseProvider is required");
  return pose;
}
