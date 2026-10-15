"use client";
import { useProjectId } from "@camera-path/store";
import { useGetLidarTimeline } from "../client/generated/client";
export function useLidarTimelineResource(id?: string) {
  const query = useGetLidarTimeline(useProjectId(id));
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
