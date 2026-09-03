import type { Project } from "@/entities/project/model/types";
import type { ResolvedCameraAim } from "@/entities/trajectory/model/types";

export function getAimLabel(aim: ResolvedCameraAim, project: Project): string {
  if (aim.kind === "follow_path") {
    return aim.direction === "forward" ? "Follow forward" : "Follow backward";
  }
  return project.scene_points[aim.scene_point_id]?.label ?? "Look target";
}
