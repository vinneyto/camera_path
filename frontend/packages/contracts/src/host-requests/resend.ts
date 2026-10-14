import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const resend = defineRequest(
  "host.resend@1",
  "Resend the email code for the pending sign-in.",
  voidSchema,
  voidSchema,
  false,
);
