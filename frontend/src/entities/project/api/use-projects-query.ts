"use client";

import { useListProjects } from "@/shared/api/generated/client";
import { rememberProjectRevision } from "@/shared/api/orval-fetch";

export function useProjectsQuery() {
  return useListProjects({
    query: {
      select: (response) => {
        response.data.forEach((project) =>
          rememberProjectRevision(project.id, project.revision),
        );
        return response.data;
      },
    },
  });
}
