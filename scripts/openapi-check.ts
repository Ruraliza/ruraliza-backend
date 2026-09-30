// Confere uma resposta real da API contra o documento OpenAPI (src/docs):
// a rota precisa estar documentada, o status também, e o corpo precisa bater com o schema.
// OpenAPI 3.0 usa schemas no estilo draft-04 (exclusiveMinimum booleano, nullable), daí o ajv-draft-04.
import Ajv, { type ValidateFunction } from 'ajv-draft-04';
import type { OpenAPIV3 } from 'openapi-types';

type Method = 'get' | 'post' | 'patch' | 'delete';

interface Operation {
  method: Method;
  template: string; // ex.: /api/farmers/{id}/farms
  pattern: RegExp;
  paramCount: number;
  responses: OpenAPIV3.ResponsesObject;
}

// Devolve uma mensagem de erro, ou null se a resposta bate com a documentação.
export type OpenApiChecker = (method: string, path: string, status: number, body: unknown) => string | null;

const METHODS: readonly Method[] = ['get', 'post', 'patch', 'delete'];

function collectOperations(document: OpenAPIV3.Document): Operation[] {
  const operations: Operation[] = [];
  for (const [template, item] of Object.entries(document.paths)) {
    if (item === undefined) continue;
    for (const method of METHODS) {
      const op = item[method];
      if (op === undefined) continue;
      const source = template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+');
      operations.push({
        method,
        template,
        pattern: new RegExp(`^${source}$`),
        paramCount: (template.match(/\{/g) ?? []).length,
        responses: op.responses
      });
    }
  }
  // Rotas literais antes das com parâmetro (ex.: /farmers/services antes de /farmers/{id}), como no Express.
  return operations.sort((a, b) => a.paramCount - b.paramCount);
}

function isReference(value: object): value is OpenAPIV3.ReferenceObject {
  return '$ref' in value;
}

export function createOpenApiChecker(document: OpenAPIV3.Document): OpenApiChecker {
  const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true });
  const components = document.components ?? {};
  const operations = collectOperations(document);
  const validators = new Map<string, ValidateFunction>();

  function validatorFor(key: string, schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): ValidateFunction {
    const cached = validators.get(key);
    if (cached) return cached;
    // Os $ref '#/components/schemas/X' resolvem contra a raiz deste schema, que carrega os components.
    const validate = ajv.compile({ components, allOf: [schema] });
    validators.set(key, validate);
    return validate;
  }

  // Rotas inexistentes (404 sem operação documentada) não são checadas.
  return (method, path, status, body) => {
    const lower = method.toLowerCase();
    const pathOnly = path.split('?')[0] ?? path;
    const op = operations.find((o) => o.method === lower && o.pattern.test(pathOnly));
    if (!op) {
      return status === 404 ? null : `rota não documentada: ${method} ${pathOnly}`;
    }

    const response = op.responses[String(status)];
    if (response === undefined) {
      return `status ${status} não documentado para ${method} ${op.template}`;
    }
    if (isReference(response)) {
      return `resposta por $ref não suportada no check: ${method} ${op.template} ${status}`;
    }

    // Respostas binárias (imagens) são conferidas pelo Content-Type no próprio smoke.
    if (response.content !== undefined && response.content['application/json'] === undefined) {
      return Object.keys(response.content).some((type) => type.startsWith('image/'))
        ? null
        : `resposta ${status} de ${method} ${op.template} sem schema JSON`;
    }

    const schema = response.content?.['application/json']?.schema;
    if (schema === undefined) {
      return `resposta ${status} de ${method} ${op.template} sem schema JSON`;
    }

    const validate = validatorFor(`${lower} ${op.template} ${status}`, schema);
    if (validate(body)) return null;
    return `corpo de ${method} ${op.template} ${status} não bate com a documentação: ${ajv.errorsText(validate.errors)}`;
  };
}
