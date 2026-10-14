import { generatedSchema } from "../generated-schema";
import { defineRequest } from "../define-request";
export const projectCloudAction = defineRequest(
  "host.projectCloudAction@1",
  "Add, remove, or update a cloud in the current project.",
  generatedSchema("projectCloudAction"),
  generatedSchema("projectCloudActionResult"),
  true,
);

export interface CloudActionResult {
  /** @asType integer */
  status: number;
}
