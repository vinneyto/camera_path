"use client";

import {
  useGetTrajectory,
  useListAnchors,
} from "@/shared/api/generated/client";

export function ProjectListResources({ projectId }: { projectId: string }) {
  const anchors = useListAnchors(projectId);
  const trajectory = useGetTrajectory(projectId);
  if (!anchors.data || !trajectory.data) return null;
  if (anchors.data.status !== 200 || trajectory.data.status !== 200)
    return null;
  return (
    <p className="text-[10px] text-muted-foreground">
      {anchors.data.data.length} anchors ·{" "}
      {trajectory.data.data.segments?.length ?? 0} segments
    </p>
  );
}
