import { stringSchema, voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const deleteAnchor = defineRequest(
  "host.deleteAnchor@1",
  "Delete an anchor from the current project.",
  stringSchema,
  voidSchema,
  true,
);
