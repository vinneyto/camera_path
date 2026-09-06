"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";

import type { Anchor } from "@/entities/project";
import {
  type GaussianHighlightVolumeOptions,
  type GaussianRenderingBackend,
  type SceneSurfaceHit,
  useGaussianHighlightVolume,
} from "@/shared/scene-surface";

import {
  ANCHOR_PLACEMENT_FLOAT_AMPLITUDE,
  ANCHOR_PLACEMENT_FLOAT_FREQUENCY,
  ANCHOR_PLACEMENT_HEIGHT,
  ANCHOR_PLACEMENT_HIGHLIGHT_RADIUS,
  ANCHOR_PLACEMENT_HIGHLIGHT_STRENGTH,
} from "./anchor-placement-constants";
import { AnchorMarker } from "./anchor-marker";

interface AnchorPlacementPreviewProps {
  backend: GaussianRenderingBackend;
  hit: SceneSurfaceHit | null;
  label: string;
}

export function AnchorPlacementPreview({ backend, hit, label }: AnchorPlacementPreviewProps) {
  const animationRef = useRef<Group>(null);
  const highlight = useMemo<GaussianHighlightVolumeOptions | null>(() => hit === null
    ? null
    : ({
        bottomOffset: 0.02,
        color: [1, 0.95, 0.78],
        height: ANCHOR_PLACEMENT_HEIGHT,
        position: hit.position,
        radius: ANCHOR_PLACEMENT_HIGHLIGHT_RADIUS,
        strength: ANCHOR_PLACEMENT_HIGHLIGHT_STRENGTH,
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
  useFrame(({ clock }) => {
    if (animationRef.current === null) return;
    animationRef.current.position.y = Math.sin(
      clock.elapsedTime * Math.PI * 2 * ANCHOR_PLACEMENT_FLOAT_FREQUENCY,
    ) * ANCHOR_PLACEMENT_FLOAT_AMPLITUDE;
  });

  return anchor === null ? null : (
    <group ref={animationRef}>
      <AnchorMarker anchor={anchor} />
    </group>
  );
}
