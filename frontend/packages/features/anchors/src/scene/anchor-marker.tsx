"use client";
import { Suspense } from "react";

import {
  AnchorMarkerContent,
  type AnchorMarkerProps,
} from "@camera-path/feature-anchors/scene/anchor-marker-content";

export function AnchorMarker(props: AnchorMarkerProps) {
  return (
    <Suspense fallback={null}>
      <AnchorMarkerContent {...props} />
    </Suspense>
  );
}
