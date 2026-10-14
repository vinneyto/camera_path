import { generatedSchema } from "../generated-schema";
import { defineDataContract } from "../define-data-contract";

export const identityState = defineDataContract(
  "host.identity.state@1",
  "Current session and sign-in progress.",
  generatedSchema("identityState"),
);
