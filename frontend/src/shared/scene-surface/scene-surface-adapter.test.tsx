import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import type { SceneSurfaceAdapter } from "./model/scene-surface-types";
import { SceneSurfaceProvider } from "./ui/scene-surface-provider";
import { SceneSurface } from "./ui/scene-surface";

test("renders a surface through the supplied adapter", () => {
  const observeSource = vi.fn();
  const adapter: SceneSurfaceAdapter = {
    Provider: ({ children }) => <>{children}</>,
    Surface: ({ source }) => {
      observeSource(source);
      return null;
    },
  };

  renderToStaticMarkup(
    <SceneSurfaceProvider adapter={adapter} background={[0, 0, 0, 1]}>
      <SceneSurface source="scene.ply" />
    </SceneSurfaceProvider>,
  );

  expect(observeSource).toHaveBeenCalledOnce();
  expect(observeSource).toHaveBeenCalledWith("scene.ply");
});
