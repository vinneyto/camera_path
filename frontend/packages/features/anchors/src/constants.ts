import type { Vec3 } from "@camera-path/types/project";

export const ANCHOR_TRANSFORM_PRECISION = 4;
export const ANCHOR_MARKER_HIT_RADIUS = 0.13;
export const ANCHOR_MARKER_HIT_POSITION: Vec3 = [0, 0.1, 0];
export const ANCHOR_MARKER_HIT_SEGMENTS = 12;
export const ANCHOR_LABEL_DISTANCE_FACTOR = 8;
export const ANCHOR_ICON_STROKE_WIDTH = 2;
export const ANCHOR_HEIGHT_DRAG_THRESHOLD_PX = 4;
export const ANCHOR_SELECTION_RADIUS = 0.08;
export const ANCHOR_SELECTION_MIN_HEIGHT = 0.08;
export const ANCHOR_SELECTION_COLLAPSED_RADIUS = 0.18;
export const ANCHOR_SELECTION_SEGMENTS = 12;
export const ANCHOR_SELECTION_MIDPOINT = 0.5;
export const ANCHOR_GENERATION_INDICATOR_CLASS =
  "absolute bottom-7 left-0 flex size-4 -translate-x-1/2 items-center justify-center rounded-full border border-orange-400/60 bg-background/90 text-orange-400 shadow-sm";
export const ANCHOR_GENERATION_SPINNER_CLASS =
  "size-3 animate-spin motion-reduce:animate-none";

export const ANCHOR_ICON_COLOR_CLASS = {
  normal: "fill-orange-500 text-orange-400",
  highlighted: "fill-orange-400 text-orange-300",
} as const;

export const ANCHOR_LABEL_BORDER_CLASS = {
  normal: "border-orange-400/40",
  highlighted: "border-orange-300/70",
} as const;
