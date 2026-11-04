"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createJob,
  getListJobsQueryKey,
} from "@camera-path/api/client/generated/client";

export function useCreateJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await createJob();
      if (response.status !== 201) throw new Error("Could not create a job");
      return response.data;
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: getListJobsQueryKey() }),
  });
}
