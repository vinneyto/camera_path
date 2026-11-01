"use client";

import { useListJobs } from "../client/generated/client";

export function useJobsCatalog() {
  return useListJobs({ query: { refetchInterval: 5000 } });
}
