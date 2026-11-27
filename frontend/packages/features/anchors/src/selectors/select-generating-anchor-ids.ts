import type { JobSummary } from "@camera-path/types/api";

export function selectGeneratingAnchorIds(
  jobs: readonly JobSummary[],
  projectId: string,
) {
  return new Set(
    jobs
      .filter(
        (job) =>
          job.type === "generation" &&
          (job.status === "queued" || job.status === "running") &&
          job.scene_placement?.project_id === projectId &&
          job.scene_placement.status === "pending",
      )
      .map((job) => job.scene_placement!.anchor.id),
  );
}
