"use client";
import { useListProjects } from "@host/adapters/api/generated/client";
import { rememberProjectRevision } from "@host/adapters/api/orval-fetch";

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
