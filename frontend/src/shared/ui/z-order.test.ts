import { describe, expect, it } from "vitest";

import {
  ANCHOR_ICON_Z_INDEX_MAX,
  ANCHOR_ICON_Z_INDEX_MIN,
  ANCHOR_ICON_Z_INDEX_RANGE,
  CONTEXT_MENU_Z_INDEX,
  FLOATING_PANEL_Z_INDEX,
  FLOATING_UI_Z_INDEX_MAX,
  FLOATING_UI_Z_INDEX_MIN,
} from "./z-order";

describe("UI z-order ranges", () => {
  it("reserves one thousand depth values for anchor icons", () => {
    expect(ANCHOR_ICON_Z_INDEX_MAX - ANCHOR_ICON_Z_INDEX_MIN + 1).toBe(1_000);
    expect(ANCHOR_ICON_Z_INDEX_RANGE).toEqual([
      ANCHOR_ICON_Z_INDEX_MAX,
      ANCHOR_ICON_Z_INDEX_MIN,
    ]);
  });

  it("keeps floating UI above every anchor icon", () => {
    expect(FLOATING_UI_Z_INDEX_MIN).toBeGreaterThan(ANCHOR_ICON_Z_INDEX_MAX);
    expect(FLOATING_PANEL_Z_INDEX).toBeGreaterThan(ANCHOR_ICON_Z_INDEX_MAX);
    expect(CONTEXT_MENU_Z_INDEX).toBeGreaterThan(ANCHOR_ICON_Z_INDEX_MAX);
    expect(CONTEXT_MENU_Z_INDEX).toBeLessThanOrEqual(FLOATING_UI_Z_INDEX_MAX);
  });
});
