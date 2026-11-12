// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Pipeline } from "@camera-path/types/api";
import { PipelineCard } from "./pipeline-card";

afterEach(cleanup);

const pipeline: Pipeline = {
  id: "pipeline-1",
  project_id: "project-1",
  message_id: "message-1",
  definition: {
    title: "Create a chair",
    start_mode: "wait_for_confirmation",
    steps: [
      {
        id: "model",
        command: "generate_model",
        input: { prompt: "A wooden chair" },
      },
    ],
  },
  status: "awaiting_confirmation",
  steps: [{ id: "model", status: "pending" }],
  created_at: "2026-11-12T12:00:00Z",
  updated_at: "2026-11-12T12:00:00Z",
  version: 1,
};

it("confirms the persisted definition and shows asynchronous step completion", () => {
  const confirm = vi.fn();
  const view = render(<PipelineCard pipeline={pipeline} onConfirm={confirm} />);
  fireEvent.click(screen.getByRole("button", { name: "Confirm and run" }));
  expect(confirm).toHaveBeenCalledWith("pipeline-1");
  view.rerender(
    <PipelineCard
      pipeline={{
        ...pipeline,
        status: "succeeded",
        version: 3,
        steps: [
          {
            id: "model",
            status: "succeeded",
            job_id: "job-1",
            output: { asset_id: "chair-1" },
          },
        ],
      }}
      onConfirm={confirm}
    />,
  );
  expect(screen.queryByRole("button", { name: "Confirm and run" })).toBeNull();
  expect(screen.getAllByText("succeeded")).toHaveLength(2);
  expect(screen.getAllByText(/chair-1/).length).toBeGreaterThan(0);
});

it("copies the actual execution including resolved inputs, job ID and error", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const failed: Pipeline = {
    ...pipeline,
    status: "failed",
    steps: [
      {
        id: "model",
        status: "failed",
        input: { image_asset_id: "image-1" },
        job_id: "job-1",
        error: { code: "generation_failed", message: "Generation failed" },
      },
    ],
  };
  render(<PipelineCard pipeline={failed} />);
  expect(screen.getByRole("alert").textContent).toContain("Generation failed");
  fireEvent.click(screen.getByRole("button", { name: "Copy execution JSON" }));
  await screen.findByText("Execution JSON copied");
  expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(failed);
});
