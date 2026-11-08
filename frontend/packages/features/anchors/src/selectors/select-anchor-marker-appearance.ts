import {
  ANCHOR_ICON_COLOR_CLASS,
  ANCHOR_LABEL_BORDER_CLASS,
  ANCHOR_SELECTION_INDICATOR_CLASS,
} from "../constants";

interface AnchorMarkerAppearanceState {
  hovered: boolean;
  selected: boolean;
  dragging: boolean;
  selectable?: boolean;
}

export function selectAnchorMarkerAppearance({
  hovered,
  selected,
  dragging,
  selectable = false,
}: AnchorMarkerAppearanceState) {
  const highlighted = hovered || selected || dragging;
  const state = highlighted ? "highlighted" : "normal";
  return {
    highlighted,
    iconColorClass: ANCHOR_ICON_COLOR_CLASS[state],
    labelBorderClass: ANCHOR_LABEL_BORDER_CLASS[state],
    showSelectionIndicator: selected || (selectable && hovered),
    selectionIndicatorClass:
      ANCHOR_SELECTION_INDICATOR_CLASS[selected ? "selected" : "hovered"],
  };
}
