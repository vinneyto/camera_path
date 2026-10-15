"use client";
import { useProjectId } from "@camera-path/store";
import { useGetDepthOfFieldTimeline } from "../client/generated/client";
export function useDepthOfFieldTimeline(id?: string) {
  const query = useGetDepthOfFieldTimeline(useProjectId(id));
  return {
    ...query,
    data: query.data?.status === 200 ? query.data : undefined,
    error:
      query.error instanceof Error
        ? query.error
        : query.error
          ? new Error(String(query.error))
          : null,
  };
}
