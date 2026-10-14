import { voidSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
import { valueSchema } from "../value-schema";
export const uploadLibraryFile = defineRequest(
  "host.uploadLibraryFile@1",
  "Upload a cloud file to the library.",
  valueSchema(
    (v): v is File => typeof File !== "undefined" && v instanceof File,
    "File",
  ),
  voidSchema,
  true,
);
