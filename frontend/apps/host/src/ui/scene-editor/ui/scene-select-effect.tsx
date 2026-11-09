"use client";
import { useEditorActions } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useAnchors, useSceneModels } from "@camera-path/api/resources";
import { SceneSelect } from "@camera-path/scene-runtime/interaction/scene-select";
import { useCameraState, useEditorTool } from "@camera-path/store";
import { anchorObjectId } from "@camera-path/types/anchor-object-id";
import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";

export function SceneSelectEffect() {
  const { selectObject, referenceChatObject } = useEditorActions();
  const { canEdit } = useAuth();
  const anchors = useAnchors();
  const models = useSceneModels();
  const { cameraMode } = useCameraState();
  const { activeTool } = useEditorTool();
  return (
    <SceneSelect
      enabled={cameraMode === "orbit" && activeTool === null}
      onActivate={(id) => {
        if (!canEdit) return;
        const anchor = anchors.data?.data.find(
          (item) => anchorObjectId(item.id) === id,
        );
        if (anchor) referenceChatObject(anchor.label);
      }}
      onSelect={(id) => {
        const name =
          id === trajectoryObjectId
            ? "Trajectory"
            : models.data?.data.find((item) => item.id === id)?.name;
        selectObject({ id, name: canEdit ? name : undefined });
      }}
    />
  );
}
