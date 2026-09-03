import type { Project } from "@/entities/project/model/types";
import type { ResolvedCameraAim } from "@/entities/trajectory/model/types";

export function getAimLabel(aim: ResolvedCameraAim, project: Project): string {
  if (aim.kind === "follow_path") {
    return aim.direction === "forward" ? "Along trajectory" : "Against trajectory";
  }
  const label = project.scene_points[aim.scene_point_id]?.label;
  return label ? `Look at ${label}` : "Look at target";
}
