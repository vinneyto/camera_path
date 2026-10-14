import { generatedSchema } from "../generated-schema";

import { defineDataContract } from "../define-data-contract";
export const libraryCatalog = defineDataContract(
  "host.libraryCatalog@1",
  "Library clouds available for browsing and placement.",
  generatedSchema("libraryCatalog"),
);
