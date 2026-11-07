"use client";
import { useEditorActions } from "@camera-path/actions";
import { SceneViewport, SceneWebGpuViewport } from "@host/ui/scene-editor";
export function SceneViewportContainer({
  bottomOverlayHeight,
  rendererBackend,
}: {
  bottomOverlayHeight: number;
  rendererBackend: "webgl" | "webgpu";
}) {
  const actions = useEditorActions();
  const Viewport =
    rendererBackend === "webgpu" ? SceneWebGpuViewport : SceneViewport;
  return (
    <Viewport
      bottomOverlayHeight={bottomOverlayHeight}
      onScenePointerLeave={() => actions.hoverObject({ id: null })}
    />
  );
}
