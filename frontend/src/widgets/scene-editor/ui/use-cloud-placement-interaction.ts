"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";

import type { Vec3 } from "@/entities/project";
import { useCloudPlacement } from "@/features/project-editor";
import type { LibraryAsset, ProjectCloud } from "@/shared/api/generated/model";
import { usePointerTap } from "@/shared/lib/use-pointer-tap";
import type { SceneSurfaceHit } from "@/shared/scene-surface";

let nextPlacementKey = 0;

interface PlacementPreview {
  asset: LibraryAsset;
  hit: SceneSurfaceHit;
  resourceKey: string;
}

export function useCloudPlacementInteraction({
  onPlace,
  clouds,
}: {
  onPlace: (assetId: string, position: Vec3) => Promise<boolean>;
  clouds: ProjectCloud[];
}) {
  const { pendingCloud, cancel } = useCloudPlacement();
  const [preview, setPreview] = useState<PlacementPreview | null>(null);
  // One identity per placement attempt, even across rapid pointer events.
  const placementIdentity = useRef<{
    asset: LibraryAsset;
    resourceKey: string;
  } | null>(null);
  const [placed, setPlaced] = useState<
    (PlacementPreview & { previousIds: Set<string> }) | null
  >(null);
  const [transferred, setTransferred] = useState<Record<string, string>>({});
  const placedCloud =
    placed &&
    clouds.find(
      (cloud) =>
        !placed.previousIds.has(cloud.id) &&
        cloud.library_asset_id === placed.asset.id &&
        cloud.translation.every(
          (value, axis) => Math.abs(value - placed.hit.position[axis]) < 0.0002,
        ),
    );
  function resourceKeyForAsset(asset: LibraryAsset): string {
    if (placementIdentity.current?.asset !== asset) {
      placementIdentity.current = {
        asset,
        resourceKey: `placement-${++nextPlacementKey}`,
      };
    }
    return placementIdentity.current.resourceKey;
  }
  const {
    cancel: cancelTap,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = usePointerTap({
    movementThreshold: 5,
    onTap: (hit: SceneSurfaceHit) => {
      if (pendingCloud === null) return;
      const committed: PlacementPreview = {
        asset: pendingCloud,
        hit,
        resourceKey: resourceKeyForAsset(pendingCloud),
      };
      setPlaced({
        ...committed,
        previousIds: new Set(clouds.map((cloud) => cloud.id)),
      });
      void onPlace(pendingCloud.id, hit.position)
        .then((created) => {
          if (!created)
            setPlaced((current) =>
              current?.resourceKey === committed.resourceKey ? null : current,
            );
        })
        .catch(() => {
          setPlaced((current) =>
            current?.resourceKey === committed.resourceKey ? null : current,
          );
        });
      cancel();
      setPreview(null);
      placementIdentity.current = null;
    },
  });

  useEffect(() => {
    if (pendingCloud === null) {
      cancelTap();
      placementIdentity.current = null;
    }
  }, [pendingCloud, cancelTap]);

  return {
    preview: preview?.asset === pendingCloud ? preview : null,
    placed,
    placedCloudId: placedCloud?.id ?? null,
    resourceKeyForCloud: (cloudId: string) =>
      transferred[cloudId] ??
      (placedCloud?.id === cloudId ? placed?.resourceKey : undefined),
    finishPlacement: (cloudId: string) => {
      if (placed !== null && placedCloud?.id === cloudId) {
        setTransferred((previous) => ({
          ...previous,
          [cloudId]: placed.resourceKey,
        }));
        setPlaced(null);
      }
    },
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
        if (pendingCloud)
          setPreview({
            asset: pendingCloud,
            hit,
            resourceKey: resourceKeyForAsset(pendingCloud),
          });
        (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
      },
      onSurfacePointerMove: (
        hit: SceneSurfaceHit,
        event: ThreeEvent<PointerEvent>,
      ) => {
        if (pendingCloud)
          setPreview({
            asset: pendingCloud,
            hit,
            resourceKey: resourceKeyForAsset(pendingCloud),
          });
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
