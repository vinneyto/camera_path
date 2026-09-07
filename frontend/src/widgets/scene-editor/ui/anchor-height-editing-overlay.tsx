"use client";

import { useMemo } from "react";

import type { Anchor } from "@/entities/project";
import {
  GaussianHighlightVolume,
  type GaussianHighlightVolumeOptions,
  type GaussianRenderingBackend,
} from "@/shared/scene-surface";

import {
  ANCHOR_PLACEMENT_FLASHLIGHT_BOTTOM_OFFSET,
  ANCHOR_PLACEMENT_FLASHLIGHT_COLOR,
  ANCHOR_PLACEMENT_FLASHLIGHT_RADIUS,
  ANCHOR_PLACEMENT_FLASHLIGHT_STRENGTH,
} from "./anchor-placement-constants";
import { AnchorHeightRuler } from "./anchor-height-ruler";

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
  const highlight = useMemo<GaussianHighlightVolumeOptions>(() => ({
    bottomOffset: ANCHOR_PLACEMENT_FLASHLIGHT_BOTTOM_OFFSET,
    color: ANCHOR_PLACEMENT_FLASHLIGHT_COLOR,
    height: Math.max(lift, 0.05),
    position: anchor.surface_position,
    radius: ANCHOR_PLACEMENT_FLASHLIGHT_RADIUS,
    strength: ANCHOR_PLACEMENT_FLASHLIGHT_STRENGTH,
    type: "color",
  }), [anchor.surface_position, lift]);

  return (
    <>
      <GaussianHighlightVolume backend={backend} options={highlight} />
      {dragging && (
        <AnchorHeightRuler
          lift={lift}
          surfacePosition={anchor.surface_position}
        />
      )}
    </>
  );
}
