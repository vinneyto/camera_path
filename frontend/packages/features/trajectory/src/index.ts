import type { FeatureSlots } from "@camera-path/slots";
import { RemoveTrajectoryCommand } from "./commands/remove-trajectory-command";
import { TrajectoryScene } from "./scene/scene";
import { TrajectoryStatus } from "./ui/status";

export const slots = {
  project: {
    commands: [RemoveTrajectoryCommand],
    scene: [TrajectoryScene],
    headerStatus: [TrajectoryStatus],
  },
} as const satisfies FeatureSlots;
