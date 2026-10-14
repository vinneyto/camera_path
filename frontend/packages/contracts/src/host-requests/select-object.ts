import { defineRequest } from "../define-request";
import { generatedSchema } from "../generated-schema";
import { voidSchema } from "../basic-schemas";
export const selectObject = defineRequest(
  "host.selectObject@1",
  "Set or clear the selected scene object, optionally checking its current ID.",
  generatedSchema("selectObject"),
  voidSchema,
  false,
);
