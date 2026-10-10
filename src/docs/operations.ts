import type { OpenAPIV3 } from 'openapi-types';
import { type SchemaName, ref } from './schemas';

// Tags (seções do Swagger UI).
export const TAGS = {
  system: 'Sistema',
  auth: 'Acesso',
  categories: 'Categorias',
  farmers: 'Produtores',
  farms: 'Fazendas',
  farmerServices: 'Serviços (produtor)',
  workers: 'Trabalhadores',
  jobs: 'Vagas (trabalhador)',
  images: 'Imagens',
  documents: 'Documentos'
} as const;
export type Tag = (typeof TAGS)[keyof typeof TAGS];

type SchemaOrRef = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 503;

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

// Envio de foto: o corpo é o próprio arquivo (Content-Type image/*), não JSON.
export const IMAGE_UPLOAD = 'image-upload';
// Envio de currículo: o corpo é o próprio PDF (Content-Type application/pdf).
export const PDF_UPLOAD = 'pdf-upload';

export interface OperationSpec {
  tag: Tag;
  summary: string;
  description?: string;
  params?: OpenAPIV3.ParameterObject[];
  body?: SchemaName | typeof IMAGE_UPLOAD | typeof PDF_UPLOAD;
  // Resposta JSON (`schema`), binária (`binary`: o Content-Type devolvido) ou stream SSE (`eventStream`).
  success: { status: 200 | 201; description: string } &
    ({ schema: SuccessSchema } | { binary: string } | { eventStream: true });
  // Cada erro possível da rota, com as situações que o causam.
  errors?: Partial<Record<ErrorStatus, string>>;
}

const errorResponse = (description: string): OpenAPIV3.ResponseObject => ({
  description,
  content: { 'application/json': { schema: ref('ApiError') } }
});

function successContent(success: OperationSpec['success']): Record<string, OpenAPIV3.MediaTypeObject> {
  if ('binary' in success) return { [success.binary]: { schema: { type: 'string', format: 'binary' } } };
  if ('eventStream' in success) return { 'text/event-stream': { schema: { type: 'string' } } };
  return { 'application/json': { schema: toSchema(success.schema) } };
}

export function operation(spec: OperationSpec): OpenAPIV3.OperationObject {
  const success = spec.success;
  const responses: OpenAPIV3.ResponsesObject = {
    [success.status]: {
      description: success.description,
      content: successContent(success)
    }
  };
  for (const [status, description] of Object.entries(spec.errors ?? {})) {
    responses[status] = errorResponse(description);
  }
  responses['500'] = errorResponse('Erro interno inesperado.');

  const op: OpenAPIV3.OperationObject = { tags: [spec.tag], summary: spec.summary, responses };
  if (spec.description !== undefined) op.description = spec.description;
  if (spec.params !== undefined) op.parameters = spec.params;
  if (spec.body === IMAGE_UPLOAD) {
    const file: OpenAPIV3.MediaTypeObject = { schema: { type: 'string', format: 'binary' } };
    op.requestBody = {
      required: true,
      description: 'O arquivo da foto (até 10 MB). O servidor reduz para no máximo 1000px e converte para WebP.',
      content: { 'image/jpeg': file, 'image/png': file, 'image/webp': file, 'image/avif': file }
    };
  } else if (spec.body === PDF_UPLOAD) {
    op.requestBody = {
      required: true,
      description: 'O arquivo PDF (até 5 MB), guardado como foi enviado.',
      content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } }
    };
  } else if (spec.body !== undefined) {
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
