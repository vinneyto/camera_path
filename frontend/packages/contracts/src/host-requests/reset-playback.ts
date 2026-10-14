import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const resetPlayback = defineRequest(
  "host.resetPlayback@1",
  "Stop playback and reset time and position to the start.",
  voidSchema,
  voidSchema,
  false,
);
