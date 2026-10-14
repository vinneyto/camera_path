import { stringSchema, voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const clearHoveredAnchor = defineRequest(
  "host.clearHoveredAnchor@1",
  "Clear hover if the specified anchor is currently hovered.",
  stringSchema,
  voidSchema,
  false,
);
