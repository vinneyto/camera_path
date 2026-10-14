import { generatedSchema } from "../generated-schema";

import { defineDataContract } from "../define-data-contract";
export const chatHistory = defineDataContract(
  "host.chatHistory@1",
  "Persisted messages in the trajectory agent conversation.",
  generatedSchema("chatHistory"),
);
