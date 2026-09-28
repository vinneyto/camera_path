// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useGaussianRenderingSettingsStore } from "../model/gaussian-rendering-settings-store";
import { RenderingSettingsPanel } from "./rendering-settings-panel";

describe("RenderingSettingsPanel", () => {
  beforeEach(() => {
    useGaussianRenderingSettingsStore.setState({ webGpuTileRenderer: true });
  });
  afterEach(cleanup);

  it("opens with WebGPU selected and switches the backend preference", () => {
    render(<RenderingSettingsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const checkbox = screen.getByRole("checkbox", {
      name: "WebGPU tile renderer (experimental)",
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(
      useGaussianRenderingSettingsStore.getState().webGpuTileRenderer,
    ).toBe(false);
    expect(checkbox.checked).toBe(false);
  });
});
