import { describe, expect, it } from "vitest";

import {
  graphX,
  PLOT_LEFT,
  PLOT_RIGHT,
} from "@camera-path/ui-kit/timeline/graph-layout";

describe("trajectory graph layout", () => {
  it("maps both timelines onto the same bounded plot area", () => {
    expect(graphX(0)).toBe(PLOT_LEFT);
    expect(graphX(1)).toBe(PLOT_RIGHT);
    expect(graphX(-1)).toBe(PLOT_LEFT);
    expect(graphX(2)).toBe(PLOT_RIGHT);
  });
});
