"use client";

import { useJobId } from "@camera-path/store";
import { useGetJob } from "../client/generated/client";
import { ApiError } from "../client/orval-fetch";

export function useJobResource(id?: string) {
  const query = useGetJob(useJobId(id), {
    query: {
      refetchInterval: (query) =>
        query.state.status === "error" ||
        (query.state.data?.status === 200 && query.state.data.data.completed_at)
          ? false
          : 2000,
      retry: (attempt, error) =>
        !(error instanceof ApiError && [404, 422].includes(error.status)) &&
        attempt < 2,
    },
  });
  return {
    ...query,
    notFound: query.error instanceof ApiError && query.error.status === 404,
  };
}
