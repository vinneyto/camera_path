import { expect, it } from "vitest";
import { mergePipelineResponse } from "./merge-pipeline-response";

it("retains completed SSE states when an older HTTP snapshot arrives later", () => {
  const latest = {
    id: "one",
    version: 5,
    status: "succeeded",
    steps: [{ id: "model", status: "succeeded" }],
  };
  const createdDuringRequest = { id: "two", version: 1, status: "queued" };
  const result = mergePipelineResponse(
    { data: [latest, createdDuringRequest], status: 200 },
    {
      data: [{ ...latest, version: 2, status: "running", steps: [] }],
      status: 200,
    },
  );
  expect(result).toEqual({ data: [latest, createdDuringRequest], status: 200 });
});
