import { stringSchema, voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const verify = defineRequest(
  "host.verify@1",
  "Verify the email code for the pending sign-in.",
  stringSchema,
  voidSchema,
  false,
);
