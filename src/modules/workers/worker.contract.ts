import type { SessionUser } from '#modules/accounts';
import type { MessageResponse } from '#shared/contracts/api';

export interface Worker {
  id: number;
  email: string;
  name: string;
  bio: string | null; // breve apresentação
  certificates: string | null;
  courses: string | null; // cursos realizados
  experience: string | null;
  phone: string;
  cpf: string; // completo só no GET do próprio perfil; mascarado em listas
  photo_url: string | null; // foto de perfil (WebP quadrado ≤ 1000×1000px), enviada por POST /workers/:id/photo
  resume_url: string | null; // currículo em PDF, enviado por POST /workers/:id/resume
  insertion_date: string;
}

// POST /workers
export interface WorkerInput {
  email: string;
  name: string;
  phone: string;
  cpf: string;
  password: string; // 8 a 128 caracteres; nunca volta nas respostas
  accept_terms: boolean; // precisa ser true: aceite dos Termos de Uso e da Política de Privacidade
  bio?: string | null;
  certificates?: string | null;
  courses?: string | null;
  experience?: string | null;
}

// PATCH /workers/:id (id e cpf não podem ser alterados; a senha muda em PATCH /workers/:id/password)
export type WorkerUpdate = Partial<Omit<WorkerInput, 'cpf' | 'password' | 'accept_terms'>>;

export interface WorkerResponse extends MessageResponse {
  worker: Worker;
}

// POST /farmers e POST /workers: o cadastro já abre a sessão da conta nova (com o token, como no login).
export interface WorkerSignupResponse extends WorkerResponse {
  user: SessionUser;
  token: string;
}
