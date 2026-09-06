import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import type { GaussianRenderingBackend } from "./model/gaussian-rendering-backend";
import { SceneSurfaceProvider } from "./ui/scene-surface-provider";

test("renders children through a renderer-agnostic backend", () => {
  const backend: GaussianRenderingBackend = {
    container: null,
    createCloud: vi.fn(),
    createHighlightVolume: vi.fn(),
    dispose: vi.fn(),
  };

  const markup = renderToStaticMarkup(
    <SceneSurfaceProvider backend={backend}>
      <span>content</span>
    </SceneSurfaceProvider>,
  );

  expect(markup).toBe("<span>content</span>");
});
