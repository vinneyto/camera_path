"use client";
import { useEditorActions } from "@camera-path/actions";
import { SceneSelect } from "@camera-path/scene-runtime/interaction/scene-select";
import { useCameraState, useEditorTool } from "@camera-path/store";

export function SceneSelectEffect() {
  const { selectObject } = useEditorActions();
  const { cameraMode } = useCameraState();
  const { activeTool } = useEditorTool();
  return (
    <SceneSelect
      enabled={cameraMode === "orbit" && activeTool === null}
      onSelect={(id) => selectObject({ id })}
    />
  );
}
