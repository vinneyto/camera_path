import { Suspense } from "react";

import {
  AnchorMarkerContent,
  type AnchorMarkerProps,
} from "./anchor-marker-content";

export function AnchorMarker(props: AnchorMarkerProps) {
  return (
    <Suspense fallback={null}>
      <AnchorMarkerContent {...props} />
    </Suspense>
  );
}
