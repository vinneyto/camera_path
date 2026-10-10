import { expect, it } from "vitest";

import { resolveInitialSceneBounds } from "./resolve-initial-scene-bounds";

it("frames ready clouds immediately, ignoring clouds added after scene load", () => {
  const initial = ["left", "right"];
  const current = new Set(["left", "right", "added-later"]);
  const ready = new Map([
    ["left", { center: [-5, 0, 0] as [number, number, number], radius: 1 }],
  ]);
  const failed = new Set<string>();

  expect(resolveInitialSceneBounds(initial, current, ready, failed)).toEqual({
    center: [-5, 0, 0],
    radius: 1,
    min: [-6, -1, -1],
    max: [-4, 1, 1],
  });
  ready.set("right", { center: [5, 0, 0], radius: 1 });
  expect(resolveInitialSceneBounds(initial, current, ready, failed)).toEqual({
    center: [0, 0, 0],
    radius: 6,
    min: [-6, -1, -1],
    max: [6, 1, 1],
  });
  current.delete("right");
  expect(resolveInitialSceneBounds(initial, current, ready, failed)).toEqual({
    center: [-5, 0, 0],
    radius: 1,
    min: [-6, -1, -1],
    max: [-4, 1, 1],
  });
});

it("frames pending model positions before any model is ready and replaces placeholders as loads finish", () => {
  const ready = new Map();
  const pending = new Map([
    ["left", { center: [-5, 0, 0] as [number, number, number], radius: 0.3 }],
    ["right", { center: [5, 0, 0] as [number, number, number], radius: 0.3 }],
  ]);
  const current = new Set(["left", "right"]);
  expect(
    resolveInitialSceneBounds(
      ["left", "right"],
      current,
      ready,
      new Set(),
      pending,
    )?.center,
  ).toEqual([0, 0, 0]);
  ready.set("left", { center: [-5, 0, 0], radius: 2 });
  expect(
    resolveInitialSceneBounds(
      ["left", "right"],
      current,
      ready,
      new Set(["right"]),
      pending,
    )?.radius,
  ).toBe(2);
  current.delete("left");
  expect(
    resolveInitialSceneBounds(
      ["left", "right"],
      current,
      ready,
      new Set(["right"]),
      pending,
    ),
  ).toBeNull();
});
