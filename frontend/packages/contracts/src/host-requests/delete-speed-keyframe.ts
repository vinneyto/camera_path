import { stringSchema, voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const deleteSpeedKeyframe = defineRequest(
  "host.deleteSpeedKeyframe@1",
  "Delete a trajectory speed keyframe.",
  stringSchema,
  voidSchema,
  true,
);
