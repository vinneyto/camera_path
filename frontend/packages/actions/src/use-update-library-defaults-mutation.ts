"use client";
import {
  getGetLibraryAssetQueryKey,
  getListLibraryAssetsQueryKey,
  updateLibraryAssetDefaults,
} from "@camera-path/api/client/generated/client";
import type { LibraryAssetDefaultsUpdate } from "@camera-path/types/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
export function useUpdateLibraryDefaultsMutation() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async ({
      assetId,
      changes,
    }: {
      assetId: string;
      changes: LibraryAssetDefaultsUpdate;
    }) => {
      await updateLibraryAssetDefaults(assetId, changes);
      await Promise.all([
        cache.invalidateQueries({ queryKey: getListLibraryAssetsQueryKey() }),
        cache.invalidateQueries({
          queryKey: getGetLibraryAssetQueryKey(assetId),
        }),
      ]);
    },
  });
}
