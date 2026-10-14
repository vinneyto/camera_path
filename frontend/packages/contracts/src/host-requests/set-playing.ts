import { booleanSchema, voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const setPlaying = defineRequest(
  "host.setPlaying@1",
  "Start or pause trajectory playback.",
  booleanSchema,
  voidSchema,
  false,
);
