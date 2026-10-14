import { stringSchema, voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const deleteProject = defineRequest(
  "host.deleteProject@1",
  "Delete a project by its ID.",
  stringSchema,
  voidSchema,
  true,
);
