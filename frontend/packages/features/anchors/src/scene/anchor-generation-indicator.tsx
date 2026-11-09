import { LoaderCircle } from "lucide-react";
import {
  ANCHOR_GENERATION_INDICATOR_CLASS,
  ANCHOR_GENERATION_SPINNER_CLASS,
  ANCHOR_ICON_STROKE_WIDTH,
} from "../constants";

export function AnchorGenerationIndicator() {
  return (
    <span
      role="img"
      aria-label="Generation in progress"
      title="Generation in progress"
      className={ANCHOR_GENERATION_INDICATOR_CLASS}
    >
      <LoaderCircle
        aria-hidden
        className={ANCHOR_GENERATION_SPINNER_CLASS}
        strokeWidth={ANCHOR_ICON_STROKE_WIDTH}
      />
    </span>
  );
}
