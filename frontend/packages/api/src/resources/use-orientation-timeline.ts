"use client";
import { useProjectId } from "@camera-path/store";
import { useGetOrientationTimeline } from "../client/generated/client";
export function useOrientationTimeline(id?: string) {
  const query = useGetOrientationTimeline(useProjectId(id));
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
