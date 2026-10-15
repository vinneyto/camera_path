"use client";
import {
  GaussianHighlightVolume,
  type GaussianHighlightVolumeOptions,
  type GaussianRenderingBackend,
} from "@camera-path/scene-runtime/surface";
import type { Anchor } from "@camera-path/types/project";

import { AnchorHeightRuler } from "@camera-path/feature-anchors/scene/anchor-height-ruler";
import {
  ANCHOR_GAUSSIAN_HIGHLIGHT_ENABLED,
  ANCHOR_PLACEMENT_FLASHLIGHT_BOTTOM_OFFSET,
  ANCHOR_PLACEMENT_FLASHLIGHT_COLOR,
  ANCHOR_PLACEMENT_FLASHLIGHT_RADIUS,
  ANCHOR_PLACEMENT_FLASHLIGHT_STRENGTH,
} from "@camera-path/feature-anchors/scene/anchor-placement-constants";

interface AnchorHeightEditingOverlayProps {
  anchor: Anchor;
  backend: GaussianRenderingBackend;
  dragging: boolean;
  lift: number;
}

export function AnchorHeightEditingOverlay({
  anchor,
  backend,
  dragging,
  lift,
}: AnchorHeightEditingOverlayProps) {
  const highlight: GaussianHighlightVolumeOptions = {
    bottomOffset: ANCHOR_PLACEMENT_FLASHLIGHT_BOTTOM_OFFSET,
    color: ANCHOR_PLACEMENT_FLASHLIGHT_COLOR,
    height: Math.max(lift, 0.05),
    position: anchor.surface_position,
    radius: ANCHOR_PLACEMENT_FLASHLIGHT_RADIUS,
    strength: ANCHOR_PLACEMENT_FLASHLIGHT_STRENGTH,
    type: "color",
  };

  return (
    <>
      {ANCHOR_GAUSSIAN_HIGHLIGHT_ENABLED && (
        <GaussianHighlightVolume backend={backend} options={highlight} />
      )}
      {dragging && (
        <AnchorHeightRuler
          lift={lift}
          surfacePosition={anchor.surface_position}
        />
      )}
    </>
  );
}
