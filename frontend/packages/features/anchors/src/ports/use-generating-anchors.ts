"use client";
import { useProjectGenerationJobs } from "@camera-path/api/resources";
import { useProjectId } from "@camera-path/store";
import { selectGeneratingAnchorIds } from "../selectors/select-generating-anchor-ids";

export function useGeneratingAnchors() {
  const projectId = useProjectId();
  const jobs = useProjectGenerationJobs(projectId);
  return selectGeneratingAnchorIds(
    jobs.data?.status === 200 ? jobs.data.data : [],
    projectId,
  );
}
