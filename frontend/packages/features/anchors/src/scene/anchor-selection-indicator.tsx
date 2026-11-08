import { Html } from "@react-three/drei";
import { Crosshair } from "lucide-react";
import type { Vec3 } from "@camera-path/types/project";
import { ANCHOR_ICON_Z_INDEX_RANGE } from "@camera-path/ui-kit";
import { cn } from "@camera-path/ui-kit/lib/cn";
import { ANCHOR_ICON_STROKE_WIDTH } from "../constants";

interface AnchorSelectionIndicatorProps {
  anchorId: string;
  position: Vec3;
  selected: boolean;
  colorClass: string;
}

export function AnchorSelectionIndicator({
  anchorId,
  position,
  selected,
  colorClass,
}: AnchorSelectionIndicatorProps) {
  return (
    <Html
      center
      position={position}
      style={{ pointerEvents: "none" }}
      zIndexRange={ANCHOR_ICON_Z_INDEX_RANGE}
    >
      <span
        aria-hidden
        data-anchor-selection-indicator={anchorId}
        data-selected={selected}
        className={cn(
          "flex size-5 items-center justify-center rounded-full border shadow-sm",
          colorClass,
        )}
      >
        <Crosshair
          className="size-3.5"
          strokeWidth={ANCHOR_ICON_STROKE_WIDTH}
        />
      </span>
    </Html>
  );
}
