import { expect, it } from "vitest";
import { inferenceJobLabel } from "./inference-job-label";
import type { InferenceStatus } from "./inference";

it("only shows Waiting for worker for a queued local job without a compatible connected worker", () => {
  const worker: InferenceStatus = {
    connected: true,
    capabilities: ["generate_image"],
    available_capabilities: [],
  };
  expect(
    inferenceJobLabel(
      { status: "queued", inference_command: "generate_model" },
      worker,
    ),
  ).toBe("Waiting for worker");
  expect(
    inferenceJobLabel(
      { status: "queued", inference_command: "generate_image" },
      worker,
    ),
  ).toBe("queued");
  expect(
    inferenceJobLabel({ status: "queued", inference_command: null }, worker),
  ).toBe("queued");
  expect(
    inferenceJobLabel(
      { status: "running", inference_command: "generate_model" },
      worker,
    ),
  ).toBe("running");
  expect(
    inferenceJobLabel(
      { status: "queued", inference_command: "generate_model" },
      undefined,
    ),
  ).toBe("queued");
});
