import { generatedSchema } from "../generated-schema";
import { defineDataContract } from "../define-data-contract";

export const playbackState = defineDataContract(
  "host.playback.state@1",
  "Trajectory playback time, position, and playing state.",
  generatedSchema("playbackState"),
);
