import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const toggleTheme = defineRequest(
  "host.toggleTheme@1",
  "Switch between light and dark themes.",
  voidSchema,
  voidSchema,
  false,
);
