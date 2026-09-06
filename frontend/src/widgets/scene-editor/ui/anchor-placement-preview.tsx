"use client";

import { useMemo } from "react";

import type { Anchor } from "@/entities/project";
import {
  type GaussianHighlightVolumeOptions,
  type GaussianRenderingBackend,
  type SceneSurfaceHit,
  useGaussianHighlightVolume,
} from "@/shared/scene-surface";

import {
  ANCHOR_PLACEMENT_HEIGHT,
  ANCHOR_PLACEMENT_RIPPLE_AMPLITUDE,
  ANCHOR_PLACEMENT_RIPPLE_RADIUS,
  ANCHOR_PLACEMENT_RIPPLE_SPEED,
  ANCHOR_PLACEMENT_RIPPLE_VERTICAL_CORE_RADIUS,
  ANCHOR_PLACEMENT_RIPPLE_VERTICAL_FALLOFF_RADIUS,
  ANCHOR_PLACEMENT_RIPPLE_WAVELENGTH,
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
        amplitude: ANCHOR_PLACEMENT_RIPPLE_AMPLITUDE,
        position: hit.position,
        radius: ANCHOR_PLACEMENT_RIPPLE_RADIUS,
        speed: ANCHOR_PLACEMENT_RIPPLE_SPEED,
        type: "ripple",
        verticalCoreRadius: ANCHOR_PLACEMENT_RIPPLE_VERTICAL_CORE_RADIUS,
        verticalFalloffRadius: ANCHOR_PLACEMENT_RIPPLE_VERTICAL_FALLOFF_RADIUS,
        wavelength: ANCHOR_PLACEMENT_RIPPLE_WAVELENGTH,
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
  useGaussianHighlightVolume(backend, highlight);

  return anchor === null ? null : <AnchorMarker anchor={anchor} />;
}
