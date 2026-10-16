import type { WorkerReputation } from '#modules/reviews';
import type { OpenService, ServiceResponse } from '#modules/services';
import type { Worker } from '#modules/workers';
import type { MessageResponse } from '#shared/contracts/api';

// Status em inglês na API; a tradução acontece só na UI.
export type ApplicationStatus = 'Pending' | 'Accepted' | 'Rejected';
export type PaymentStatus = 'Completed';

export interface ServiceApplication {
  id: number;
  service_id: number;
  worker_id: number;
  status: ApplicationStatus;
  auto_rejected?: boolean; // recusada pelo aceite de outro; volta a Pending se o aceito desistir
  insertion_date: string;
}

// GET /farmers/services/:id/applications: CPF, telefone e e-mail do trabalhador mascarados
// (o contato só é trocado pela conversa, quando os dois liberam o WhatsApp).
export interface ApplicationWithWorker extends ServiceApplication {
  worker: Worker;
  reputation: WorkerReputation; // avaliações publicadas do trabalhador
  verified: boolean; // identidade conferida pela equipe (selo)
}

// GET /workers/:id/applications
export interface ApplicationWithService extends ServiceApplication {
  service: OpenService;
}

// PATCH /farmers/services/:id/analyze
export type AnalyzeAction = 'Accept' | 'Reject';

export interface AnalyzeInput {
  application_id: number;
  action: AnalyzeAction;
}

// POST /workers/services/:id/apply e PATCH /workers/services/:id/withdraw
export interface WorkerActionInput {
  worker_id: number;
}

// Pagamento (simulado) que conclui o serviço.
export interface Payment {
  id: number;
  service_id: number;
  farmer_id: number;
  worker_id: number;
  value: number;
  status: PaymentStatus;
  insertion_date: string;
}

export interface ApplicationResponse extends MessageResponse {
  application: ServiceApplication;
}

// PATCH /farmers/services/:id/analyze: o aceite também devolve o serviço (agora In Progress).
export type AnalyzeResponse = ApplicationResponse | (ApplicationResponse & ServiceResponse);

export interface PaymentResponse extends ServiceResponse {
  payment: Payment;
}
