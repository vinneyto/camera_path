import { generatedSchema } from "../generated-schema";
import { booleanSchema } from "../basic-schemas";
import { defineRequest } from "../define-request";
export const login = defineRequest(
  "host.login@1",
  "Start sign-in with a username and password.",
  generatedSchema("login"),
  booleanSchema,
  false,
);

export interface LoginInput {
  username: string;
  password: string;
}
