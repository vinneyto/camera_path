"use client";
import { useProjectId } from "@camera-path/store";
import { useGetSpeedTimeline } from "../client/generated/client";
export function useSpeedTimeline(id?: string) {
  const query = useGetSpeedTimeline(useProjectId(id));
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
