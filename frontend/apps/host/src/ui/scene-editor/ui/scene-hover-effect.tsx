"use client";
import { useEditorActions } from "@camera-path/actions";
import { SceneHover } from "@camera-path/scene-runtime/interaction/scene-hover";
import { useCameraState, useEditorTool } from "@camera-path/store";

export function SceneHoverEffect() {
  const { hoverObject } = useEditorActions();
  const { cameraMode } = useCameraState();
  const { activeTool } = useEditorTool();
  return (
    <SceneHover
      enabled={cameraMode === "orbit" && activeTool === null}
      onHover={(id) => hoverObject({ id })}
    />
  );
}
