import { defineRequest } from "../define-request";
import { generatedSchema } from "../generated-schema";
import { voidSchema } from "../basic-schemas";
export const hoverObject = defineRequest(
  "host.hoverObject@1",
  "Set or clear the hovered scene object, optionally checking its current ID.",
  generatedSchema("hoverObject"),
  voidSchema,
  false,
);
