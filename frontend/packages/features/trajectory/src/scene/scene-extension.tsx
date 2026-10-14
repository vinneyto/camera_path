"use client";
import {
  compiledTrajectory,
  cameraMode,
  editorTool,
  sceneInteraction,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import {
  selectObject,
  clearTrajectory,
} from "@camera-path/contracts/host-requests";
import { trajectoryObjectId } from "@camera-path/contracts/trajectory-object-id";
import {
  useData,
  useDataQuery,
  useRequestAction,
  useRequestMutation,
} from "@camera-path/extension-api";
import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";
import { useEffect } from "react";
import { manifest } from "../manifest";
import { TrajectoryLine } from "./trajectory-line";
export function SceneExtension() {
  const query = useDataQuery(manifest, compiledTrajectory);
  const trajectory = query.data?.data;
  const mode = useData(manifest, cameraMode);
  const tool = useData(manifest, editorTool).activeTool;
  const selected =
    useData(manifest, sceneInteraction).selectedObjectId === trajectoryObjectId;
  const canEdit = useData(manifest, projectPermissions).canEdit;
  const select = useRequestAction(manifest, selectObject);
  const deletion = useRequestMutation(manifest, clearTrajectory);
  const services = useSceneServices();
  const viewport = useViewportServices();
  useEffect(() => {
    viewport.setMessage(
      "trajectory.error",
      deletion.error ? { text: deletion.error.message, error: true } : null,
    );
    return () => viewport.setMessage("trajectory.error", null);
  }, [viewport, deletion.error]);
  const hovered =
    useData(manifest, sceneInteraction).hoveredObjectId === trajectoryObjectId;
  const cursor =
    mode === "orbit" && tool === null && hovered ? "pointer" : null;
  useEffect(() => {
    viewport.setCursor("trajectory.scene", cursor);
    return () => viewport.setCursor("trajectory.scene", null);
  }, [viewport, cursor]);
  if (mode !== "orbit" || !trajectory) return null;
  return (
    <TrajectoryLine
      trajectory={trajectory}
      selected={selected}
      dark={services.dark}
      interactive={tool === null}
      onSelect={() => void select({ id: trajectoryObjectId })}
      onOpenMenu={(position) => {
        if (canEdit)
          viewport.openMenu(
            [
              {
                destructive: true,
                disabled: deletion.isPending,
                label: "Delete trajectory",
                onSelect: () => deletion.mutate(undefined),
              },
            ],
            position,
          );
      }}
    />
  );
}
