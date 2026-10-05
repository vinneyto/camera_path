"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { Vec3 } from "@/entities/project";
import { useCloudPlacement } from "@/features/project-editor";
import type { LibraryAsset, ProjectCloud } from "@/shared/api/generated/model";
import { usePointerTap } from "@/shared/lib/use-pointer-tap";
import type { SceneSurfaceHit } from "@/shared/scene-surface";

let nextPlacementKey = 0;
const ORIGIN_HIT: SceneSurfaceHit = { position: [0, 0, 0], normal: [0, 1, 0] };
type PlacementPointerEvent = Pick<
  PointerEvent,
  "pointerId" | "clientX" | "clientY"
>;

export interface PlacementPreview {
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

  const resetPreview = useEffectEvent(() => {
    cancelTap();
    placementIdentity.current = null;
    setPreview(
      pendingCloud
        ? {
            asset: pendingCloud,
            hit: ORIGIN_HIT,
            resourceKey: resourceKeyForAsset(pendingCloud),
          }
        : null,
    );
  });
  useEffect(() => {
    resetPreview();
  }, [pendingCloud]);

  function updatePreview(hit: SceneSurfaceHit | null) {
    if (!pendingCloud) return;
    const resolved = hit ?? ORIGIN_HIT;
    const resourceKey = resourceKeyForAsset(pendingCloud);
    setPreview((current) =>
      current?.asset === pendingCloud &&
      current.hit.position.every((v, i) => v === resolved.position[i]) &&
      current.hit.normal.every((v, i) => v === resolved.normal[i])
        ? current
        : { asset: pendingCloud, hit: resolved, resourceKey },
    );
  }

  return {
    preview: preview?.asset === pendingCloud ? preview : null,
    placed,
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
      updatePreview(null);
    },
    updatePreview,
    pointerEvents: {
      onPointerDown: (
        hit: SceneSurfaceHit | null,
        event: PlacementPointerEvent,
      ) => {
        handlePointerDown(hit ?? ORIGIN_HIT, event);
        updatePreview(hit);
      },
      onPointerMove: (
        hit: SceneSurfaceHit | null,
        event: PlacementPointerEvent,
      ) => {
        updatePreview(hit);
        handlePointerMove(hit ?? ORIGIN_HIT, event);
      },
      onPointerUp: (
        hit: SceneSurfaceHit | null,
        event: PlacementPointerEvent,
      ) => {
        handlePointerMove(hit ?? ORIGIN_HIT, event);
        handlePointerUp(event);
      },
      onPointerLeave: () => {
        cancelTap();
        updatePreview(null);
      },
      onPointerCancel: () => {
        cancelTap();
        updatePreview(null);
      },
    },
  };
}
