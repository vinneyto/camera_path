"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  deleteLibraryAsset,
  getGetLibraryAssetQueryKey,
  getListLibraryAssetsQueryKey,
  type listLibraryAssetsResponse,
} from "@/shared/api/generated/client";

export function useDeleteLibraryAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => deleteLibraryAsset(assetId),
    onSuccess: async (_, assetId) => {
      const affected = {
        predicate: (query: { queryKey: readonly unknown[] }) => {
          const path = query.queryKey[0];
          return (
            typeof path === "string" &&
            (path === "/api/v1/library" ||
              path === `/api/v1/library/${assetId}` ||
              /^\/api\/v1\/projects(?:\/|$)/.test(path))
          );
        },
      };
      await queryClient.cancelQueries(affected);
      queryClient.setQueryData<listLibraryAssetsResponse>(
        getListLibraryAssetsQueryKey(),
        (current) =>
          current && {
            ...current,
            data: current.data.filter((asset) => asset.id !== assetId),
          },
      );
      queryClient.removeQueries({
        queryKey: getGetLibraryAssetQueryKey(assetId),
        exact: true,
      });
      await queryClient.invalidateQueries(affected);
    },
  });
}
