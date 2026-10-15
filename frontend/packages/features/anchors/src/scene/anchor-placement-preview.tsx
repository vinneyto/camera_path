"use client";
import {
  GaussianHighlightVolume,
  type GaussianHighlightVolumeOptions,
  type GaussianRenderingBackend,
  type SceneSurfaceHit,
} from "@camera-path/scene-runtime/surface";
import type { Anchor } from "@camera-path/types/project";

import { AnchorMarker } from "@camera-path/feature-anchors/scene/anchor-marker";
import {
  ANCHOR_GAUSSIAN_HIGHLIGHT_ENABLED,
  ANCHOR_PLACEMENT_FLASHLIGHT_BOTTOM_OFFSET,
  ANCHOR_PLACEMENT_FLASHLIGHT_COLOR,
  ANCHOR_PLACEMENT_FLASHLIGHT_RADIUS,
  ANCHOR_PLACEMENT_FLASHLIGHT_STRENGTH,
  ANCHOR_PLACEMENT_HEIGHT,
} from "@camera-path/feature-anchors/scene/anchor-placement-constants";

interface AnchorPlacementPreviewProps {
  backend: GaussianRenderingBackend;
  hit: SceneSurfaceHit;
  label: string;
}

export function AnchorPlacementPreview({
  backend,
  hit,
  label,
}: AnchorPlacementPreviewProps) {
  const highlight: GaussianHighlightVolumeOptions = {
    bottomOffset: ANCHOR_PLACEMENT_FLASHLIGHT_BOTTOM_OFFSET,
    color: ANCHOR_PLACEMENT_FLASHLIGHT_COLOR,
    height: ANCHOR_PLACEMENT_HEIGHT,
    position: hit.position,
    radius: ANCHOR_PLACEMENT_FLASHLIGHT_RADIUS,
    strength: ANCHOR_PLACEMENT_FLASHLIGHT_STRENGTH,
    type: "color",
  };
  const anchor: Anchor = {
    id: "anchor-placement-preview",
    label,
    lift: ANCHOR_PLACEMENT_HEIGHT,
    lift_axis: "world_up",
    surface_normal: hit.normal,
    surface_position: hit.position,
  };
  return (
    <>
      {ANCHOR_GAUSSIAN_HIGHLIGHT_ENABLED && (
        <GaussianHighlightVolume backend={backend} options={highlight} />
      )}
      <AnchorMarker anchor={anchor} />
    </>
  );
}
