"use client";
import { useEditorActions } from "@camera-path/actions";
import { useEditorTool } from "@camera-path/store";
import { SceneViewport, SceneWebGpuViewport } from "@host/ui/scene-editor";
export function SceneViewportContainer({
  bottomOverlayHeight,
  rendererBackend,
}: {
  bottomOverlayHeight: number;
  rendererBackend: "webgl" | "webgpu";
}) {
  const tool = useEditorTool();
  const actions = useEditorActions();
  const Viewport =
    rendererBackend === "webgpu" ? SceneWebGpuViewport : SceneViewport;
  return (
    <Viewport
      bottomOverlayHeight={bottomOverlayHeight}
      onScenePointerLeave={() => actions.hoverObject({ id: null })}
      onScenePointerMissed={() => {
        if (tool.activeTool === null) actions.selectObject({ id: null });
      }}
    />
  );
}
