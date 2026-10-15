"use client";
import { useListLibraryAssets } from "../client/generated/client";
export function useLibraryCatalog() {
  const query = useListLibraryAssets();
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
