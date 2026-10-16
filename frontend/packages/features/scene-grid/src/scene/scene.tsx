"use client";
import { useUserSettings } from "@camera-path/store";

import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { useSurfaceEvents } from "@camera-path/scene-runtime/viewport/use-surface-events";
import { SceneGrid as SceneGridView } from "./scene-grid";
export function SceneGrid() {
  const preferences = useUserSettings();
  const services = useSceneServices();
  const events = useSurfaceEvents();
  return preferences.showGrid ? (
    <SceneGridView
      dark={services.dark}
      interactive={services.interactive}
      placementEvents={events}
    />
  ) : null;
}
