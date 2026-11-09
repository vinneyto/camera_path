"use client";

import { useListJobs } from "../client/generated/client";
import { JOBS_POLL_INTERVAL_MS } from "../constants";

export function useJobsCatalog() {
  return useListJobs({ query: { refetchInterval: JOBS_POLL_INTERVAL_MS } });
}
