"use client";

import { useEffect } from "react";
import { API_URL } from "@camera-path/api/config";
import { useJobId } from "@camera-path/store";
import { useGetJob } from "../client/generated/client";
import { ApiError } from "../client/orval-fetch";

export function useJobResource(id?: string) {
  const jobId = useJobId(id);
  const query = useGetJob(jobId, {
    query: {
      retry: (attempt, error) =>
        !(error instanceof ApiError && [404, 422].includes(error.status)) &&
        attempt < 2,
    },
  });
  const status =
    query.data?.status === 200 ? query.data.data.status : undefined;
  const active = status === "queued" || status === "running";
  const { refetch } = query;

  useEffect(() => {
    if (!active || typeof EventSource === "undefined") return;
    const source = new EventSource(
      `${API_URL}/api/v1/jobs/${encodeURIComponent(jobId)}/events`,
    );
    const refresh = () => void refetch();
    source.addEventListener("job-status", refresh);
    source.onerror = refresh;
    return () => source.close();
  }, [active, jobId, refetch]);

  return {
    ...query,
    notFound: query.error instanceof ApiError && query.error.status === 404,
  };
}
