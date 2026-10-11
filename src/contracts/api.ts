
// Todo erro da API: status HTTP 400/401/403/404/409/500/503 com este corpo.
export interface ApiError {
  error: string;
}

// Escritas (POST/PATCH/DELETE) respondem { message, <entidade> }.
export interface MessageResponse {
  message: string;
}

export interface HealthResponse {
  message: string;
}
