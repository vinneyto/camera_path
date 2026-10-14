"use client";
import { preferencesState } from "@camera-path/contracts/host-data";
import { useData } from "@camera-path/extension-api";
import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { useSurfaceEvents } from "@camera-path/scene-runtime/viewport/use-surface-events";
import { manifest } from "../manifest";
import { SceneGrid } from "./scene-grid";
export function SceneExtension() {
  const preferences = useData(manifest, preferencesState);
  const services = useSceneServices();
  const events = useSurfaceEvents();
  return preferences.showGrid ? (
    <SceneGrid
      dark={services.dark}
      interactive={services.interactive}
      placementEvents={events}
    />
  ) : null;
}
