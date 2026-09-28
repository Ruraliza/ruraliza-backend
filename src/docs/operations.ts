import type { OpenAPIV3 } from 'openapi-types';
import { type SchemaName, ref } from './schemas';

// Tags (seções do Swagger UI).
export const TAGS = {
  system: 'Sistema',
  categories: 'Categorias',
  farmers: 'Produtores',
  farms: 'Fazendas',
  farmerServices: 'Serviços (produtor)',
  workers: 'Trabalhadores',
  jobs: 'Vagas (trabalhador)'
} as const;
export type Tag = (typeof TAGS)[keyof typeof TAGS];

type SchemaOrRef = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
type ErrorStatus = 400 | 404 | 409;

// Resposta de sucesso: um schema nomeado, ou lista dele com `listOf`.
export type SuccessSchema = SchemaName | { listOf: SchemaName };

function toSchema(schema: SuccessSchema): SchemaOrRef {
  return typeof schema === 'string' ? ref(schema) : { type: 'array', items: ref(schema.listOf) };
}

export function pathParam(name: string, description: string): OpenAPIV3.ParameterObject {
  return { name, in: 'path', required: true, description, schema: { type: 'integer', minimum: 1 }, example: 1 };
}

export function queryParam(name: string, description: string, schema: SchemaOrRef): OpenAPIV3.ParameterObject {
  return { name, in: 'query', required: false, description, schema };
}

export interface OperationSpec {
  tag: Tag;
  summary: string;
  description?: string;
  params?: OpenAPIV3.ParameterObject[];
  body?: SchemaName;
  success: { status: 200 | 201; description: string; schema: SuccessSchema };
  // Cada erro possível da rota, com as situações que o causam.
  errors?: Partial<Record<ErrorStatus, string>>;
}

const errorResponse = (description: string): OpenAPIV3.ResponseObject => ({
  description,
  content: { 'application/json': { schema: ref('ApiError') } }
});

export function operation(spec: OperationSpec): OpenAPIV3.OperationObject {
  const responses: OpenAPIV3.ResponsesObject = {
    [spec.success.status]: {
      description: spec.success.description,
      content: { 'application/json': { schema: toSchema(spec.success.schema) } }
    }
  };
  for (const [status, description] of Object.entries(spec.errors ?? {})) {
    responses[status] = errorResponse(description);
  }
  responses['500'] = errorResponse('Erro interno inesperado.');

  const op: OpenAPIV3.OperationObject = { tags: [spec.tag], summary: spec.summary, responses };
  if (spec.description !== undefined) op.description = spec.description;
  if (spec.params !== undefined) op.parameters = spec.params;
  if (spec.body !== undefined) {
    op.requestBody = { required: true, content: { 'application/json': { schema: ref(spec.body) } } };
    // Todo corpo pode chegar como JSON malformado.
    const current = responses['400'];
    const invalidJson = 'Corpo não é um JSON válido.';
    responses['400'] = errorResponse(
      current !== undefined && 'description' in current ? `${current.description}\n\n${invalidJson}` : invalidJson
    );
  }
  return op;
}
