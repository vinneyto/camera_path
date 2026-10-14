import { defineRequest } from "../define-request";
import { generatedSchema } from "../generated-schema";
import { voidSchema } from "../basic-schemas";
export const seekPlayback = defineRequest(
  "host.seekPlayback@1",
  "Seek playback to a normalized path position using the current motion profile.",
  generatedSchema("seekPlayback"),
  voidSchema,
  false,
);
