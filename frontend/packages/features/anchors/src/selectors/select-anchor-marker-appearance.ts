import {
  ANCHOR_ICON_COLOR_CLASS,
  ANCHOR_LABEL_BORDER_CLASS,
} from "../constants";

interface AnchorMarkerAppearanceState {
  hovered: boolean;
  selected: boolean;
  dragging: boolean;
}

export function selectAnchorMarkerAppearance({
  hovered,
  selected,
  dragging,
}: AnchorMarkerAppearanceState) {
  const highlighted = hovered || selected || dragging;
  const state = highlighted ? "highlighted" : "normal";
  return {
    highlighted,
    iconColorClass: ANCHOR_ICON_COLOR_CLASS[state],
    labelBorderClass: ANCHOR_LABEL_BORDER_CLASS[state],
  };
}
