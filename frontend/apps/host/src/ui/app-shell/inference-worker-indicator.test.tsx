// @vitest-environment happy-dom
import type { InferenceStatus } from "@camera-path/types/inference";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InferenceWorkerIndicator } from "./inference-worker-indicator";

const state = vi.hoisted(() => ({
  canEdit: false,
  status: undefined as InferenceStatus | undefined,
}));
vi.mock("@camera-path/api/inference/use-inference-status", () => ({
  useInferenceStatus: () => state,
}));
afterEach(cleanup);

it("hides from guests and reports connected capabilities, then reports disconnect", () => {
  const { rerender } = render(<InferenceWorkerIndicator />);
  expect(screen.queryByRole("status")).toBeNull();
  state.canEdit = true;
  state.status = {
    connected: true,
    capabilities: ["generate_image", "generate_model"],
    available_capabilities: ["generate_image"],
  };
  rerender(<InferenceWorkerIndicator />);
  expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
    "Inference worker connected: 2D and 3D",
  );
  state.status = {
    connected: false,
    capabilities: [],
    available_capabilities: [],
  };
  rerender(<InferenceWorkerIndicator />);
  expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
    "Inference worker offline",
  );
});
