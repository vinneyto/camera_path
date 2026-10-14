import { generatedSchema } from "../generated-schema";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";

export const setCameraMode = defineRequest(
  "host.setCameraMode@1",
  "Switch between orbit and trajectory camera modes.",
  generatedSchema("setCameraMode"),
  voidSchema,
  false,
);
