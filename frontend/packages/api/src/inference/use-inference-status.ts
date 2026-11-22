"use client";

import { getInferenceStatus } from "@camera-path/api/client/generated/client";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useQuery } from "@tanstack/react-query";

export function useInferenceStatus(needed = true) {
  const { canEdit } = useAuth();
  const query = useQuery({
    queryKey: ["inference-status"],
    queryFn: async ({ signal }) => {
      const response = await getInferenceStatus({ signal });
      return response.data;
    },
    enabled: canEdit && needed,
    refetchInterval: needed ? 5_000 : false,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  return {
    canEdit,
    status: canEdit && !query.isError ? query.data : undefined,
  };
}
