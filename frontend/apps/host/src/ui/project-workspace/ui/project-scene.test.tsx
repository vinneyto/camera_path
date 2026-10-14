// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExtensionProvider } from "@camera-path/extension-api/extension-provider";
import type { Extension } from "@camera-path/extension-api";
import { ProjectScene } from "./project-scene";
vi.mock("./use-element-height", () => ({
  useElementHeight: () => ({ elementRef: { current: null }, height: 100 }),
}));
vi.mock("./scene-viewport-container", () => ({
  SceneViewportContainer: ({
    bottomOverlayHeight,
  }: {
    bottomOverlayHeight: number;
  }) => <div data-testid="viewport" data-inset={bottomOverlayHeight} />,
}));
afterEach(cleanup);
const extension: Extension = {
  manifest: {
    manifestVersion: 1,
    id: "unknown",
    scope: "project",
    reads: [],
    calls: [],
    frames: [],
    capabilities: [],
    contributions: [
      { id: "unknown.overlay", kind: "ui", slot: "scene.overlay" },
    ],
  },
  contributions: [
    { id: "unknown.overlay", Component: () => <div>Unknown overlay</div> },
  ],
};
it("mounts an unknown overlay without feature-specific props and reserves its measured height", () => {
  render(
    <ExtensionProvider extensions={[extension]}>
      <ProjectScene rendererBackend="webgpu" />
    </ExtensionProvider>,
  );
  expect(screen.getByText("Unknown overlay")).toBeTruthy();
  expect(screen.getByTestId("viewport").dataset.inset).toBe("112");
});
