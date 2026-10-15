"use client";
import { useAssetId } from "@camera-path/store";
import { useGetLibraryAsset } from "../client/generated/client";
export function useLibraryAssetResource(id?: string) {
  const query = useGetLibraryAsset(useAssetId(id));
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
