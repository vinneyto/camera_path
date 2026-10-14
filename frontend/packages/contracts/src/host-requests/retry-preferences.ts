import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const retryPreferences = defineRequest(
  "host.retryPreferences@1",
  "Reload user preferences.",
  voidSchema,
  voidSchema,
  false,
);
