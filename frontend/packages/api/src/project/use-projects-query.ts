"use client";
import { useListProjects } from "@camera-path/api/client/generated/client";
import { rememberProjectRevision } from "@camera-path/api/client/orval-fetch";

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
