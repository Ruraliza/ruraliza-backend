import type { OpenAPIV3 } from 'openapi-types';

// Peças para escrever os schemas OpenAPI do contrato. Entidades usam additionalProperties: false
// para que o smoke test acuse qualquer campo não documentado nas respostas.
export type Schema = OpenAPIV3.SchemaObject;
export type Properties = Record<string, Schema | OpenAPIV3.ReferenceObject>;

// $ref para um schema nomeado. Quem usa declara os nomes que pode referenciar
// (ex.: `const ref: RefTo<FarmSchemaName> = refTo`), então um $ref quebrado não compila.
export type RefTo<N extends string> = (name: N) => OpenAPIV3.ReferenceObject;

export const refTo: RefTo<string> = (name) => ({ $ref: `#/components/schemas/${name}` });

export function object(properties: Properties, required: readonly string[], description?: string): Schema {
  return {
    type: 'object',
    properties,
    required: [...required],
    additionalProperties: false,
    ...(description === undefined ? {} : { description })
  };
}

// Corpos de entrada: campos extras são ignorados ou recusados pela própria rota (ver descrição).
export function input(properties: Properties, required: readonly string[], description: string): Schema {
  return { type: 'object', properties, required: [...required], description };
}

// --- Propriedades reaproveitadas ---

export const id: Schema = { type: 'integer', minimum: 1, example: 1 };
export const isoDate: Schema = { type: 'string', format: 'date-time', example: '2026-09-28T12:00:00.000Z' };
export const latitude: Schema = { type: 'number', minimum: -90, maximum: 90, example: -22.1165, description: 'Graus decimais.' };
export const longitude: Schema = { type: 'number', minimum: -180, maximum: 180, example: -43.2092, description: 'Graus decimais.' };
