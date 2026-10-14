import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { stringSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const createProject = defineRequest(
  "host.createProject@1",
  "Create a project with the given name.",
  stringSchema,
  apiSchema<Api.ProjectMetadata>("ProjectMetadata"),
  true,
);
