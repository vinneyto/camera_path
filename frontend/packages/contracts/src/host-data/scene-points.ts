import { generatedSchema } from "../generated-schema";

import { defineDataContract } from "../define-data-contract";
export const scenePoints = defineDataContract(
  "host.scenePoints@1",
  "Named scene points used as camera aim and focus targets.",
  generatedSchema("scenePoints"),
);
