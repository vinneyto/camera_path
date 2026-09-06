"use client";

import { useMemo } from "react";

import type { Anchor } from "@/entities/project";
import {
  GaussianHighlightVolume,
  type GaussianHighlightVolumeOptions,
  type GaussianRenderingBackend,
  type SceneSurfaceHit,
} from "@/shared/scene-surface";

import {
  ANCHOR_PLACEMENT_FLASHLIGHT_BOTTOM_OFFSET,
  ANCHOR_PLACEMENT_FLASHLIGHT_COLOR,
  ANCHOR_PLACEMENT_FLASHLIGHT_RADIUS,
  ANCHOR_PLACEMENT_FLASHLIGHT_STRENGTH,
  ANCHOR_PLACEMENT_HEIGHT,
} from "./anchor-placement-constants";
import { AnchorMarker } from "./anchor-marker";

interface AnchorPlacementPreviewProps {
  backend: GaussianRenderingBackend;
  hit: SceneSurfaceHit | null;
  label: string;
}

export function AnchorPlacementPreview({ backend, hit, label }: AnchorPlacementPreviewProps) {
  const highlight = useMemo<GaussianHighlightVolumeOptions | null>(() => hit === null
    ? null
    : ({
        bottomOffset: ANCHOR_PLACEMENT_FLASHLIGHT_BOTTOM_OFFSET,
        color: ANCHOR_PLACEMENT_FLASHLIGHT_COLOR,
        height: ANCHOR_PLACEMENT_HEIGHT,
        position: hit.position,
        radius: ANCHOR_PLACEMENT_FLASHLIGHT_RADIUS,
        strength: ANCHOR_PLACEMENT_FLASHLIGHT_STRENGTH,
        type: "color",
      }), [hit]);
  const anchor = useMemo<Anchor | null>(() => hit === null
    ? null
    : ({
        id: "anchor-placement-preview",
        label,
        lift: ANCHOR_PLACEMENT_HEIGHT,
        lift_axis: "world_up",
        surface_normal: hit.normal,
        surface_position: hit.position,
      }), [hit, label]);
  return (
    <>
      {highlight !== null && (
        <GaussianHighlightVolume backend={backend} options={highlight} />
      )}
      {anchor !== null && <AnchorMarker anchor={anchor} />}
    </>
  );
}
