"use client";

import { Html } from "@react-three/drei";
import { MapPin } from "lucide-react";
import { useMemo } from "react";

import {
  type GaussianHighlightVolumeOptions,
  type GaussianRenderingBackend,
  type SceneSurfaceHit,
  useGaussianHighlightVolume,
} from "@/shared/scene-surface";

import {
  ANCHOR_PLACEMENT_HEIGHT,
  ANCHOR_PLACEMENT_HIGHLIGHT_RADIUS,
} from "./anchor-placement-constants";

interface AnchorPlacementPreviewProps {
  backend: GaussianRenderingBackend;
  hit: SceneSurfaceHit | null;
}

export function AnchorPlacementPreview({ backend, hit }: AnchorPlacementPreviewProps) {
  const highlight = useMemo<GaussianHighlightVolumeOptions | null>(() => hit === null
    ? null
    : ({
        bottomOffset: 0.02,
        color: [1, 0.95, 0.78],
        height: ANCHOR_PLACEMENT_HEIGHT,
        position: hit.position,
        radius: ANCHOR_PLACEMENT_HIGHLIGHT_RADIUS,
        strength: 0.42,
      }), [hit]);
  useGaussianHighlightVolume(backend, highlight);

  if (hit === null) return null;
  return (
    <Html
      center
      position={[
        hit.position[0],
        hit.position[1] + ANCHOR_PLACEMENT_HEIGHT,
        hit.position[2],
      ]}
      style={{ pointerEvents: "none" }}
    >
      <div className="rounded-full border border-orange-300/70 bg-background/90 p-1.5 shadow-lg backdrop-blur">
        <MapPin className="size-4 text-orange-500" />
      </div>
    </Html>
  );
}
