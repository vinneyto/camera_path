import type { Project } from "@camera-path/types/project";
import type { ResolvedCameraAim } from "@camera-path/types/trajectory";

export function getAimLabel(
  aim: ResolvedCameraAim,
  project: Pick<Project, "scene_points">,
): string {
  if (aim.kind === "follow_path") {
    return aim.direction === "forward"
      ? "Along trajectory"
      : "Against trajectory";
  }
  const label = project.scene_points[aim.scene_point_id]?.label;
  return label ? `Look at ${label}` : "Look at target";
}
