// @vitest-environment happy-dom

import { render, waitFor } from "@testing-library/react";
import { Object3D } from "three";
import { expect, it, vi } from "vitest";

import { SceneSurface } from "./scene-surface";

vi.mock("./use-gaussian-cloud", () => ({
  useGaussianCloud: () => [
    {
      bounds: { center: [0, 0, 0], radius: 1 },
      object: new Object3D(),
    },
    false,
    null,
  ],
}));

it("reports the cloud ready without attaching its Object3D during placement handoff", async () => {
  const onReady = vi.fn();
  const { container } = render(
    <SceneSurface
      onReady={onReady}
      renderObject={false}
      source={{ kind: "url", url: "/cloud.ply" }}
    />,
  );
  expect(container.childNodes).toHaveLength(0);
  await waitFor(() =>
    expect(onReady).toHaveBeenCalledWith({
      bounds: { center: [0, 0, 0], radius: 1 },
    }),
  );
});
