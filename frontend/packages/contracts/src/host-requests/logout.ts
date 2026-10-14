import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const logout = defineRequest(
  "host.logout@1",
  "Sign out of the current editor session.",
  voidSchema,
  voidSchema,
  false,
);
