"use client";
import { useGenerationPlacementUpdates } from "@camera-path/actions";
export function GenerationPlacementEffect() {
  useGenerationPlacementUpdates();
  return null;
}
