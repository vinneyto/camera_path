import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const savePreferences = defineRequest(
  "host.savePreferences@1",
  "Save renderer and grid preferences.",
  apiSchema<Api.UserSettingsUpdate>("UserSettingsUpdate"),
  voidSchema,
  false,
);
