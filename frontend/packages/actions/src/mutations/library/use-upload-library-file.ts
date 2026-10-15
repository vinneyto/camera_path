import { uploadLibraryFile } from "@camera-path/api/upload-library-file";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getListLibraryAssetsQueryKey } from "@camera-path/api/client/generated/client";

export function useUploadLibraryFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadLibraryFile,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: getListLibraryAssetsQueryKey(),
      }),
  });
}
