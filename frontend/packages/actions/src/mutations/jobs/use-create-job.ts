"use client";

import type { JobCreate } from "@camera-path/types/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createJob,
  getListJobsQueryKey,
} from "@camera-path/api/client/generated/client";

export function useCreateJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (data: JobCreate) => {
      const response = await createJob(data);
      if (response.status !== 201) throw new Error("Could not create a job");
      return response.data;
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: getListJobsQueryKey() }),
  });
}
