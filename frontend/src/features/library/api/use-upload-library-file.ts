import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  completeLibraryUpload,
  createLibraryUpload,
  getListLibraryAssetsQueryKey,
} from "@/shared/api/generated/client";

export function useUploadLibraryFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const created = await createLibraryUpload({
        name: file.name,
        format: "ply",
        size_bytes: file.size,
      });
      if (created.status !== 201)
        throw new Error("Could not prepare the upload");
      const upload = await fetch(created.data.upload_url, {
        method: "PUT",
        body: file,
      });
      if (!upload.ok) throw new Error(`File upload failed (${upload.status})`);
      const completed = await completeLibraryUpload(created.data.id);
      if (completed.status !== 200)
        throw new Error("Could not confirm the uploaded file");
      return completed.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: getListLibraryAssetsQueryKey(),
      }),
  });
}
