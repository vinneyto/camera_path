"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  deleteLibraryAssets,
  getGetLibraryAssetQueryKey,
  getListLibraryAssetsQueryKey,
  type listLibraryAssetsResponse,
} from "@/shared/api/generated/client";

export function useDeleteLibraryAssets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetIds: string[]) =>
      deleteLibraryAssets({ asset_ids: assetIds }),
    onSuccess: async (_, assetIds) => {
      const affected = {
        predicate: (query: { queryKey: readonly unknown[] }) => {
          const path = query.queryKey[0];
          return (
            typeof path === "string" &&
            (path === "/api/v1/library" ||
              assetIds.some((id) => path === `/api/v1/library/${id}`) ||
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
            data: current.data.filter((asset) => !assetIds.includes(asset.id)),
          },
      );
      for (const id of assetIds)
        queryClient.removeQueries({
          queryKey: getGetLibraryAssetQueryKey(id),
          exact: true,
        });
      await queryClient.invalidateQueries(affected);
    },
  });
}
