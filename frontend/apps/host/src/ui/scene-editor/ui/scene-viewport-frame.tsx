"use client";
import { AnchorHint } from "@camera-path/feature-anchors";
import { CameraViewToolbar } from "@camera-path/feature-camera-view";
import { CloudPlacementHint } from "@camera-path/feature-scene-models";
import { ViewportProvider } from "@camera-path/scene-runtime/viewport/viewport-provider";
import { FLOATING_UI_Z_INDEX_MIN } from "@camera-path/ui-kit";
import { useTheme } from "@camera-path/ui-kit/theme/theme-provider";
import { SceneMessage } from "./scene-message";
import type { SceneViewportFrameProps } from "./scene-viewport-types";
const DARK_BACKGROUND = [12 / 255, 16 / 255, 23 / 255, 1] as const;
const LIGHT_BACKGROUND = [235 / 255, 233 / 255, 229 / 255, 1] as const;
export function SceneViewportFrame({
  available,
  renderScene,
  unavailableMessage = "This renderer is unavailable in this browser",
  onScenePointerLeave,
}: SceneViewportFrameProps) {
  const dark = useTheme().theme === "dark";
  return (
    <div
      className="relative h-full w-full"
      onPointerLeave={onScenePointerLeave}
    >
      <ViewportProvider>
        {available &&
          renderScene({
            background: dark ? DARK_BACKGROUND : LIGHT_BACKGROUND,
            dark,
          })}
        {available === false && <SceneMessage message={unavailableMessage} />}
        {available && (
          <div className="absolute left-3 top-3">
            <AnchorHint />
            <CloudPlacementHint />
          </div>
        )}
        {available && (
          <div
            className="absolute right-3 top-3"
            style={{ zIndex: FLOATING_UI_Z_INDEX_MIN }}
          >
            <CameraViewToolbar />
          </div>
        )}
      </ViewportProvider>
    </div>
  );
}
