import { stringSchema, voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const hoverAnchor = defineRequest(
  "host.hoverAnchor@1",
  "Mark an anchor as hovered.",
  stringSchema,
  voidSchema,
  false,
);
