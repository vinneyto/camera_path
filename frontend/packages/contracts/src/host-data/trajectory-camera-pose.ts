import { generatedSchema } from "../generated-schema";
import { defineDataContract } from "../define-data-contract";
export const trajectoryCameraPose = defineDataContract(
  "host.trajectoryCamera.pose@1",
  "Camera pose evaluated for the current frame and project revision.",
  generatedSchema("trajectoryCameraPose"),
);
