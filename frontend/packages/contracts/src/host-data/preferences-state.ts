import { generatedSchema } from "../generated-schema";
import { defineDataContract } from "../define-data-contract";

export const preferencesState = defineDataContract(
  "host.preferences.state@1",
  "Renderer and grid preferences with loading and save status.",
  generatedSchema("preferencesState"),
);
