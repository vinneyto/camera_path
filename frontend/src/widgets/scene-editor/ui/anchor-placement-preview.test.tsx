// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { expect, it, vi } from "vitest";

import type { GaussianRenderingBackend } from "@/shared/scene-surface";

import { AnchorPlacementPreview } from "./anchor-placement-preview";

const pendingTexture = vi.hoisted(() => new Promise<never>(() => {}));

vi.mock("./anchor-marker", () => ({
  AnchorMarker: () => {
    throw pendingTexture;
  },
}));

it("keeps the scene mounted while the first anchor marker texture loads", () => {
  render(
    <Suspense fallback={<span>Scene suspended</span>}>
      <span>Gaussian cloud</span>
      <AnchorPlacementPreview
        backend={{} as GaussianRenderingBackend}
        hit={{ position: [0, 0, 0], normal: [0, 1, 0] }}
        label="Anchor 1"
      />
    </Suspense>,
  );

  expect(screen.getByText("Gaussian cloud")).not.toBeNull();
  expect(screen.queryByText("Scene suspended")).toBeNull();
});
