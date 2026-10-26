"use client";
import {
  useClearTrajectoryMutation,
  useEditorActions,
} from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useCompiledTrajectoryResource } from "@camera-path/api/resources";
import {
  useCameraState,
  useEditorTool,
  useSceneInteraction,
} from "@camera-path/store";

import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";
import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
import { useEffect } from "react";
import { TrajectoryLine } from "./trajectory-line";
export function TrajectoryScene() {
  const query = useCompiledTrajectoryResource();
  const trajectory = query.data?.data;
  const mode = useCameraState().cameraMode;
  const tool = useEditorTool().activeTool;
  const selected =
    useSceneInteraction().selectedObjectId === trajectoryObjectId;
  const canEdit = useAuth().canEdit;
  const select = useEditorActions().selectObject;
  const deletion = useClearTrajectoryMutation();
  const services = useSceneServices();
  const viewport = useViewportServices();
  useEffect(() => {
    viewport.setMessage(
      "trajectory.error",
      deletion.error ? { text: deletion.error.message, error: true } : null,
    );
    return () => viewport.setMessage("trajectory.error", null);
  }, [viewport, deletion.error]);
  const hovered = useSceneInteraction().hoveredObjectId === trajectoryObjectId;
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
