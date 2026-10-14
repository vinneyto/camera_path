import { generatedSchema } from "../generated-schema";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";

export const setActiveTool = defineRequest(
  "host.setActiveTool@1",
  "Select or clear the active editor tool.",
  generatedSchema("setActiveTool"),
  voidSchema,
  false,
);
