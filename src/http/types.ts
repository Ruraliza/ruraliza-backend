import type { RequestHandler } from 'express';
import type { ApiError } from '../contracts';

// Parâmetros de rota (sempre string na URL).
export interface IdParams {
  id: string;
}
export interface FarmParams {
  id: string;
  farmId: string;
}
export interface FarmPhotoParams extends FarmParams {
  photoId: string;
}
export interface ImageParams {
  id: string;
}
export type NoParams = Record<string, never>;

// Query string e corpo chegam sem garantia de formato: são tratados como unknown e validados.
export type Query = Readonly<Record<string, unknown>>;
type NoLocals = Record<string, never>;

// Handler da API: corpo `unknown`, resposta tipada `Res` ou o erro padrão { error }.
// Todos os parâmetros genéricos do Express são explícitos (os padrões dele são `any`).
export type Handler<Res, Params = NoParams> = RequestHandler<Params, Res | ApiError, unknown, Query, NoLocals>;

// Status HTTP de erro usados pela API (413 só nos envios de foto grandes demais).
export type ErrorStatus = 400 | 404 | 409 | 413;
