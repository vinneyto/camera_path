import { describe, expect, it } from "vitest";

import type { SceneSurfaceHit } from "@/shared/scene-surface";

import { AnchorPlacementGesture } from "./anchor-placement-gesture";

const HIT: SceneSurfaceHit = { normal: [0, 1, 0], position: [1, 2, 3] };

describe("AnchorPlacementGesture", () => {
  it("returns a stationary click exactly once", () => {
    const gesture = new AnchorPlacementGesture(5);
    gesture.begin(HIT, 1, "mouse", 10, 20);

    expect(gesture.finish(1)).toEqual({ hit: HIT, pointerType: "mouse" });
    expect(gesture.finish(1)).toBeNull();
  });

  it("cancels placement after pointer movement", () => {
    const gesture = new AnchorPlacementGesture(5);
    gesture.begin(HIT, 1, "touch", 10, 20);

    expect(gesture.move(HIT, 1, 16, 20)).toBe(true);
    expect(gesture.finish(1)).toEqual({ hit: null, pointerType: "touch" });
  });

  it("cancels placement after camera movement", () => {
    const gesture = new AnchorPlacementGesture(5);
    gesture.begin(HIT, 1, "mouse", 10, 20);
    gesture.markCameraMoved();

    expect(gesture.finish(1)).toEqual({ hit: null, pointerType: "mouse" });
  });
});
