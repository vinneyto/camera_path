"use client";
import { useEditorStoreApi } from "@host/editor/model/editor-store-provider";
import { SceneViewport, SceneWebGpuViewport } from "@host/ui/scene-editor";
export function SceneViewportContainer({
  bottomOverlayHeight,
  rendererBackend,
}: {
  bottomOverlayHeight: number;
  rendererBackend: "webgl" | "webgpu";
}) {
  const store = useEditorStoreApi();
  const Viewport =
    rendererBackend === "webgpu" ? SceneWebGpuViewport : SceneViewport;
  return (
    <Viewport
      bottomOverlayHeight={bottomOverlayHeight}
      onScenePointerLeave={() =>
        store.getState().sceneInteractionActions.hoverObject({ id: null })
      }
      onScenePointerMissed={() => {
        if (store.getState().tool.activeTool === null)
          store.getState().sceneInteractionActions.selectObject({ id: null });
      }}
    />
  );
}
