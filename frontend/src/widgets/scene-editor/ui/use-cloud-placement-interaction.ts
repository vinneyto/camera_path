"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useState } from "react";

import type { Vec3 } from "@/entities/project";
import { useCloudPlacement } from "@/features/project-editor";
import type { LibraryAsset } from "@/shared/api/generated/model";
import { usePointerTap } from "@/shared/lib/use-pointer-tap";
import type { SceneSurfaceHit } from "@/shared/scene-surface";

export function useCloudPlacementInteraction({
  onPlace,
}: {
  onPlace: (assetId: string, position: Vec3) => void;
}) {
  const { pendingCloud, cancel } = useCloudPlacement();
  const [preview, setPreview] = useState<{
    asset: LibraryAsset;
    hit: SceneSurfaceHit;
  } | null>(null);
  const {
    cancel: cancelTap,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = usePointerTap({
    movementThreshold: 5,
    onTap: (hit: SceneSurfaceHit) => {
      if (pendingCloud === null) return;
      onPlace(pendingCloud.id, hit.position);
      cancel();
      setPreview(null);
    },
  });

  useEffect(() => {
    if (pendingCloud === null) cancelTap();
  }, [pendingCloud, cancelTap]);

  return {
    previewHit: preview?.asset === pendingCloud ? preview.hit : null,
    handleControlsChange: () => {
      cancelTap();
      setPreview(null);
    },
    surfaceEventProps: {
      onSurfacePointerDown: (
        hit: SceneSurfaceHit,
        event: ThreeEvent<PointerEvent>,
      ) => {
        handlePointerDown(hit, event);
        if (pendingCloud) setPreview({ asset: pendingCloud, hit });
        (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
      },
      onSurfacePointerMove: (
        hit: SceneSurfaceHit,
        event: ThreeEvent<PointerEvent>,
      ) => {
        if (pendingCloud) setPreview({ asset: pendingCloud, hit });
        handlePointerMove(hit, event);
      },
      onSurfacePointerUp: (
        _hit: SceneSurfaceHit,
        event: ThreeEvent<PointerEvent>,
      ) => {
        (event.target as Element | null)?.releasePointerCapture?.(
          event.pointerId,
        );
        handlePointerUp(event);
      },
      onPointerOut: () => setPreview(null),
      onPointerCancel: () => {
        cancelTap();
        setPreview(null);
      },
    },
  };
}
