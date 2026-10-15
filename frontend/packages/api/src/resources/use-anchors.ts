"use client";
import { useProjectId } from "@camera-path/store";
import type { Anchor } from "@camera-path/types/project";
import { useListAnchors } from "../client/generated/client";
export function useAnchors(id?: string) {
  const query = useListAnchors(useProjectId(id));
  return {
    ...query,
    error:
      query.error instanceof Error
        ? query.error
        : query.error
          ? new Error(String(query.error))
          : null,
    data:
      query.data?.status === 200
        ? { ...query.data, data: query.data.data as Anchor[] }
        : undefined,
  };
}
