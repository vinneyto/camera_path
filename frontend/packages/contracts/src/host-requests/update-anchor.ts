import { generatedSchema } from "../generated-schema";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const updateAnchor = defineRequest(
  "host.updateAnchor@1",
  "Update the lift of an existing anchor.",
  generatedSchema("updateAnchor"),
  voidSchema,
  true,
);

export interface UpdateAnchorInput {
  anchorId: string;
  lift: number;
}
