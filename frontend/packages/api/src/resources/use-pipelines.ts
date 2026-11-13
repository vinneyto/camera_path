"use client";
import { useProjectId } from "@camera-path/store";
import { useListProjectPipelines } from "../client/generated/client";
import { mergePipelineResponse } from "../merge-pipeline-response";

export function usePipelines() {
  return useListProjectPipelines(useProjectId(), {
    query: { structuralSharing: mergePipelineResponse },
  });
}
