import { type Schema, object } from './schema-kit';

// Respostas genéricas, usadas por todos os módulos (e pelas respostas de erro de operation()).
export type CoreSchemaName = 'ApiError' | 'MessageResponse';

export const coreSchemas = {
  ApiError: object({ error: { type: 'string', example: 'Serviço não encontrado.' } }, ['error'], 'Formato de todo erro da API.'),
  MessageResponse: object({ message: { type: 'string', example: 'Farmer deleted successfully!' } }, ['message'])
} satisfies Record<CoreSchemaName, Schema>;
