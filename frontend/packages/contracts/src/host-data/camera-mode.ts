import { generatedSchema } from "../generated-schema";
import { defineDataContract } from "../define-data-contract";

export const cameraMode = defineDataContract(
  "host.camera.mode@1",
  "Current orbit or trajectory camera mode.",
  generatedSchema("cameraMode"),
);
