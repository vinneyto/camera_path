import { generatedSchema } from "../generated-schema";

import { defineDataContract } from "../define-data-contract";
export const projectsCatalog = defineDataContract(
  "host.projectsCatalog@1",
  "Projects available in the project list.",
  generatedSchema("projectsCatalog"),
);
