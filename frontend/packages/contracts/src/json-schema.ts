import Ajv from "ajv/dist/2020";
import schemas from "./api-schemas.json";
import hostSchemas from "./generated/host-schemas.json";
import type { RuntimeSchema } from "./contract-types";
const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true });
ajv.addSchema(schemas);
ajv.addSchema(hostSchemas);
export function jsonSchema<T>(schema: object): RuntimeSchema<T> {
  const validate = ajv.compile(schema);
  return {
    parse(value) {
      if (!validate(value))
        throw new TypeError(ajv.errorsText(validate.errors));
      return value as T;
    },
  };
}
