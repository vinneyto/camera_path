// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import { useGaussianRenderingSettingsStore } from "./gaussian-rendering-settings-store";

describe("Gaussian rendering settings store", () => {
  beforeEach(() => {
    localStorage.clear();
    useGaussianRenderingSettingsStore.setState({
      dprMode: "1x",
      webGpuTileRenderer: true,
    });
  });

  it("defaults Gaussian rendering to one physical pixel per CSS pixel", () => {
    expect(useGaussianRenderingSettingsStore.getState().dprMode).toBe("1x");
  });

  it("switches to system DPR without resetting project editor state", () => {
    useGaussianRenderingSettingsStore.getState().setDprMode("system");

    expect(useGaussianRenderingSettingsStore.getState().dprMode).toBe("system");
  });

  it("defaults to WebGPU and restores the renderer choice from storage", async () => {
    expect(
      useGaussianRenderingSettingsStore.getState().webGpuTileRenderer,
    ).toBe(true);

    useGaussianRenderingSettingsStore.getState().setWebGpuTileRenderer(false);
    expect(
      JSON.parse(
        localStorage.getItem("camera-path-gaussian-rendering-settings")!,
      ).state.webGpuTileRenderer,
    ).toBe(false);

    useGaussianRenderingSettingsStore.setState({ webGpuTileRenderer: true });
    localStorage.setItem(
      "camera-path-gaussian-rendering-settings",
      JSON.stringify({ state: { webGpuTileRenderer: false }, version: 0 }),
    );
    await useGaussianRenderingSettingsStore.persist.rehydrate();
    expect(
      useGaussianRenderingSettingsStore.getState().webGpuTileRenderer,
    ).toBe(false);
  });
});
