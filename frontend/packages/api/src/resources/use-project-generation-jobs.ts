"use client";
import { useProjectId } from "@camera-path/store";
import { useListProjectGenerationJobs } from "../client/generated/client";
import { JOBS_POLL_INTERVAL_MS } from "../constants";

export function useProjectGenerationJobs(id?: string) {
  return useListProjectGenerationJobs(useProjectId(id), {
    query: { refetchInterval: JOBS_POLL_INTERVAL_MS },
  });
}
