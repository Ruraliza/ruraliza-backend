import type { RequestHandler } from 'express';
import type { ApiError } from '../../../contracts';
import type { Account } from '../../../domain/passwords';
import type { SystemUserRecord } from '../../../domain/system-users';

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
export interface DocumentParams {
  id: string;
}
export type NoParams = Record<string, never>;

// Query string e corpo chegam sem garantia de formato: são tratados como unknown e validados.
export type Query = Readonly<Record<string, unknown>>;

// Quem fez a requisição, conferido pelo token (ver src/http/access.ts). Relido a cada requisição.
export type Principal = { kind: 'account'; account: Account } | { kind: 'system'; user: SystemUserRecord };

// `principal` só existe nas rotas que exigem token.
export interface Locals {
  principal?: Principal;
}

// Handler da API: corpo `unknown`, resposta tipada `Res` ou o erro padrão { error }.
// Todos os parâmetros genéricos do Express são explícitos (os padrões dele são `any`).
export type Handler<Res, Params = NoParams> = RequestHandler<Params, Res | ApiError, unknown, Query, Locals>;

// Status HTTP de erro usados pela API (401: sem sessão válida, ou e-mail/senha errados; 403: sem
// permissão, ou a configuração do mapa pedida fora do frontend; 413 só nos envios grandes demais).
export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 503;
