import Ajv from "ajv/dist/2020";
import schemas from "./api-schemas.json";
import type { RuntimeSchema } from "./contract-types";
const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true });
ajv.addSchema(schemas);
export function apiSchema<T>(
  name: keyof typeof schemas.components.schemas,
): RuntimeSchema<T> {
  const validate = ajv.compile({
    $ref: `camera-path-api#/components/schemas/${name}`,
  });
  return {
    parse(value) {
      if (!validate(value))
        throw new TypeError(ajv.errorsText(validate.errors));
      return value as T;
    },
  };
}
