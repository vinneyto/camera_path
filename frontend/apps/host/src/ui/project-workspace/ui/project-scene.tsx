"use client";
import { FLOATING_PANEL_Z_INDEX } from "@camera-path/ui-kit";
import { TrajectoryPanelSlot } from "@host/ui/project-workspace/ui/trajectory-panel-slot";
import { SceneViewportContainer } from "./scene-viewport-container";
import { useElementHeight } from "./use-element-height";
export function ProjectScene({
  rendererBackend,
}: {
  rendererBackend: "webgl" | "webgpu";
}) {
  const { elementRef, height } = useElementHeight(true);
  return (
    <div className="relative min-h-0 flex-1">
      <SceneViewportContainer
        rendererBackend={rendererBackend}
        bottomOverlayHeight={height ? height + 12 : 0}
      />
      <div
        ref={elementRef}
        className="absolute bottom-3 left-3 right-3"
        style={{ zIndex: FLOATING_PANEL_Z_INDEX }}
      >
        <TrajectoryPanelSlot />
      </div>
    </div>
  );
}
