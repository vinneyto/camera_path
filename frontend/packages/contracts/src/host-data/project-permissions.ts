import { generatedSchema } from "../generated-schema";
import { defineDataContract } from "../define-data-contract";
export const projectPermissions = defineDataContract(
  "host.project.permissions@1",
  "Permissions for editing the current project.",
  generatedSchema("projectPermissions"),
);

/** @additionalProperties false */
export interface ProjectPermissions {
  readonly canEdit: boolean;
}
