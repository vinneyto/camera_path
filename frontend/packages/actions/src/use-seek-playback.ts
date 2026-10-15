"use client";
import { useCompiledTrajectoryResource } from "@camera-path/api/resources";
import {
  createPlaybackTable,
  timeAtPathPosition,
} from "@camera-path/trajectory-math";
import { useEditorActions } from "./actions-provider";
export function useSeekPlayback() {
  const query = useCompiledTrajectoryResource();
  const trajectory = query.data?.data;
  const actions = useEditorActions();
  return (position: number) => {
    const pathPosition = Math.max(0, Math.min(1, position));
    const table = trajectory ? createPlaybackTable(trajectory) : [];
    actions.setPlaybackFrame({
      pathPosition,
      elapsed: timeAtPathPosition(table, pathPosition),
    });
  };
}
