"use client";

import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadLibraryFile } from "@camera-path/api/upload-library-file";
import {
  createJob,
  getListJobsQueryKey,
  getListLibraryAssetsQueryKey,
} from "@camera-path/api/client/generated/client";

export function useCreateImageJob() {
  const client = useQueryClient();
  const uploaded = useRef<{ file: File; id: string } | null>(null);
  return useMutation({
    mutationFn: async (data: { file?: File; imageAssetId?: string }) => {
      let id = data.imageAssetId;
      if (data.file) {
        if (uploaded.current?.file !== data.file) {
          const asset = await uploadLibraryFile(data.file);
          uploaded.current = { file: data.file, id: asset.id };
          await client.invalidateQueries({
            queryKey: getListLibraryAssetsQueryKey(),
          });
        }
        id = uploaded.current.id;
      }
      if (!id) throw new Error("Select an image first.");
      const response = await createJob({
        type: "generation",
        input: { image_asset_id: id },
        start: true,
      });
      if (response.status !== 201)
        throw new Error("Could not create the image job.");
      return response.data;
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: getListJobsQueryKey() }),
  });
}
