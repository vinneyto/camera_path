"use client";
import { useAnchors, useSceneModels } from "@camera-path/api/resources";
import { useSceneInteraction } from "@camera-path/store";

export function useChatSelection() {
  const { selectedObjectId } = useSceneInteraction();
  const anchors = useAnchors();
  const models = useSceneModels();
  if (!selectedObjectId) return null;
  const name =
    selectedObjectId === "trajectory"
      ? "Trajectory"
      : selectedObjectId.startsWith("anchor:")
        ? anchors.data?.data.find((a) => `anchor:${a.id}` === selectedObjectId)
            ?.label
        : models.data?.data.find((m) => m.id === selectedObjectId)?.name;
  return name ? { id: selectedObjectId, name } : null;
}
