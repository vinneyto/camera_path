import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const cancelLogin = defineRequest(
  "host.cancelLogin@1",
  "Cancel the pending sign-in and clear its error.",
  voidSchema,
  voidSchema,
  false,
);
