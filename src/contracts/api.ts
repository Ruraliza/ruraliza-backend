import type { SessionUser } from '#modules/accounts';
import type { Worker } from './worker';

// Todo erro da API: status HTTP 400/401/403/404/409/500/503 com este corpo.
export interface ApiError {
  error: string;
}

// Escritas (POST/PATCH/DELETE) respondem { message, <entidade> }.
export interface MessageResponse {
  message: string;
}

export interface WorkerResponse extends MessageResponse {
  worker: Worker;
}

// POST /farmers e POST /workers: o cadastro já abre a sessão da conta nova (com o token, como no login).
export interface WorkerSignupResponse extends WorkerResponse {
  user: SessionUser;
  token: string;
}

export interface HealthResponse {
  message: string;
}
