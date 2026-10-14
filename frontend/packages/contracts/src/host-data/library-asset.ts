import type * as Api from "../api";
import { apiSchema } from "../api-schema";
import { defineDataContract } from "../define-data-contract";
export const libraryAsset = defineDataContract(
  "host.libraryAsset@1",
  "Details and placement defaults of the current library cloud.",
  apiSchema<Api.LibraryAsset>("LibraryAsset"),
);
