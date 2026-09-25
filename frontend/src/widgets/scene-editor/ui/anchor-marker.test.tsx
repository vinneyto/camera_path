// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { expect, it, vi } from "vitest";

import type { Anchor } from "@/entities/project";

import { AnchorMarker } from "./anchor-marker";

const pendingTexture = vi.hoisted(() => new Promise<never>(() => {}));

vi.mock("@react-three/drei", () => ({
  Html: () => null,
  useTexture: () => {
    throw pendingTexture;
  },
}));

it("keeps the scene mounted while an anchor marker texture loads", () => {
  render(
    <Suspense fallback={<span>Scene suspended</span>}>
      <span>Gaussian cloud</span>
      <AnchorMarker
        anchor={
          {
            id: "anchor",
            label: "A",
            lift: 0,
            lift_axis: "world_up",
            surface_position: [0, 0, 0],
            surface_normal: [0, 1, 0],
          } satisfies Anchor
        }
      />
    </Suspense>,
  );

  expect(screen.getByText("Gaussian cloud")).not.toBeNull();
  expect(screen.queryByText("Scene suspended")).toBeNull();
});
