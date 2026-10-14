import { generatedSchema } from "../generated-schema";

import { defineDataContract } from "../define-data-contract";
export const anchors = defineDataContract(
  "host.anchors@1",
  "Anchors defining the current project path.",
  generatedSchema("anchors"),
);
