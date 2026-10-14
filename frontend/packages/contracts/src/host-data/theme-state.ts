import { generatedSchema } from "../generated-schema";
import { defineDataContract } from "../define-data-contract";
export const themeState = defineDataContract(
  "host.appearance.theme@1",
  "Current light or dark appearance theme.",
  generatedSchema("themeState"),
);
