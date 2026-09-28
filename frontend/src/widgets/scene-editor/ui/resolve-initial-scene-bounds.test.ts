import { expect, it } from "vitest";

import { resolveInitialSceneBounds } from "./resolve-initial-scene-bounds";

it("waits for all initial clouds, ignoring clouds added after scene load", () => {
  const initial = ["left", "right"];
  const current = new Set(["left", "right", "added-later"]);
  const ready = new Map([
    ["left", { center: [-5, 0, 0] as [number, number, number], radius: 1 }],
  ]);
  const failed = new Set<string>();

  expect(
    resolveInitialSceneBounds(initial, current, ready, failed),
  ).toBeUndefined();
  ready.set("right", { center: [5, 0, 0], radius: 1 });
  expect(resolveInitialSceneBounds(initial, current, ready, failed)).toEqual({
    center: [0, 0, 0],
    radius: 6,
  });
  current.delete("right");
  expect(resolveInitialSceneBounds(initial, current, ready, failed)).toEqual({
    center: [-5, 0, 0],
    radius: 1,
  });
});
