import { generatedSchema } from "../generated-schema";
import { defineDataContract } from "../define-data-contract";
export const trajectorySelection = defineDataContract(
  "host.trajectory.selection@1",
  "Whether the trajectory is selected in the editor.",
  generatedSchema("trajectorySelection"),
);

export interface TrajectorySelectionState {
  readonly trajectorySelected: boolean;
}
