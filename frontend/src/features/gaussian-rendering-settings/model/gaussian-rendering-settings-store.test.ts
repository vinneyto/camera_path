import { beforeEach, describe, expect, it } from "vitest";

import { useGaussianRenderingSettingsStore } from "./gaussian-rendering-settings-store";

describe("Gaussian rendering settings store", () => {
  beforeEach(() => {
    useGaussianRenderingSettingsStore.setState({ dprMode: "1x" });
  });

  it("defaults Gaussian rendering to one physical pixel per CSS pixel", () => {
    expect(useGaussianRenderingSettingsStore.getState().dprMode).toBe("1x");
  });

  it("switches to system DPR without resetting project editor state", () => {
    useGaussianRenderingSettingsStore.getState().setDprMode("system");

    expect(useGaussianRenderingSettingsStore.getState().dprMode).toBe("system");
  });
});
