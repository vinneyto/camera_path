import { generatedSchema } from "../generated-schema";

import { defineDataContract } from "../define-data-contract";
export const sceneModels = defineDataContract(
  "host.sceneModels@1",
  "Cloud instances placed in the current project.",
  generatedSchema("sceneModels"),
);
