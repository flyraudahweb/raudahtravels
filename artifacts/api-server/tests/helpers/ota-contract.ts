import Ajv from "ajv";
import addFormats from "ajv-formats";
import { otaOpenApi } from "../../src/services/ota/apiDocumentation";

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const spec = otaOpenApi();
export function validateOtaSchema(schema: any, data: unknown) {
  const validate = ajv.compile({ ...schema, components: spec.components });
  if (!validate(data))
    throw new Error(ajv.errorsText(validate.errors, { separator: "\n" }));
}
export function validateOtaResponse(
  path: string,
  method: string,
  status: number,
  data: unknown,
) {
  const operation = (spec.paths as any)[path]?.[method.toLowerCase()];
  const schema =
    operation?.responses[status]?.content?.["application/json"]?.schema;
  if (!schema)
    throw new Error(`Undocumented OTA response: ${method} ${path} ${status}`);
  validateOtaSchema(schema, data);
}
