import { stringSchema, voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const navigate = defineRequest(
  "host.navigate@1",
  "Navigate to a supported application route.",
  stringSchema,
  voidSchema,
  false,
);
