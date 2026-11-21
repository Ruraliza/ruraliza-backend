import type { WorkerReputation } from '#modules/reviews';
import type { AgreementTerms, OpenService, ServiceResponse } from '#modules/services';
import type { Worker } from '#modules/workers';
import type { MessageResponse } from '#shared/contracts/api';

// Status em inglês na API; a tradução acontece só na UI.
export type ApplicationStatus = 'Pending' | 'Accepted' | 'Rejected';
export type PaymentStatus = 'Completed';
export type ProposalStatus = 'Pending' | 'Accepted' | 'Declined' | 'Superseded';
export type ProposalSide = 'farmer' | 'worker';

export interface ServiceApplication {
  id: number;
  service_id: number;
  worker_id: number;
  status: ApplicationStatus;
  auto_rejected?: boolean; // recusada pelo aceite de outro; volta a Pending se o aceito desistir
  message?: string; // apresentação do trabalhador (até 300 caracteres; telefone e e-mail saem ocultos)
  insertion_date: string;
}

// GET /farmers/services/:id/applications: CPF, telefone e e-mail do trabalhador mascarados
// (o contato só é trocado pela conversa, quando os dois liberam o WhatsApp).
export interface ApplicationWithWorker extends ServiceApplication {
  worker: Worker;
  accepted_proposal: Proposal | null; // a proposta aceita pelos dois; sem ela, o aceite não passa
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

// PATCH /workers/services/:id/withdraw
export interface WorkerActionInput {
  worker_id: number;
}

// POST /workers/services/:id/apply
export interface ApplyInput extends WorkerActionInput {
  message?: string | null; // opcional, até 300 caracteres
}

// Proposta de valor (por unidade), feita na conversa de uma candidatura. Qualquer lado propõe enquanto a
// conversa está aberta e a vaga está Pending; só o outro lado aceita ou recusa. Uma proposta nova substitui
// a pendente (Superseded), e a aceita não muda mais: ela é a concordância dos dois para o aceite.
export interface Proposal extends AgreementTerms {
  id: number;
  application_id: number;
  service_id: number;
  farmer_id: number;
  worker_id: number;
  proposed_by: ProposalSide;
  status: ProposalStatus;
  insertion_date: string;
  answered_at: string | null; // quando foi aceita ou recusada
}

// POST /chats/:id/proposals
export interface ProposalInput {
  amount: number;
  unit: AgreementTerms['unit'];
  notes?: string | null; // até 300 caracteres
}

// PATCH /chats/:id/proposals/:proposalId
export type ProposalAnswer = 'Accept' | 'Decline';

export interface ProposalAnswerInput {
  action: ProposalAnswer;
}

export interface ProposalResponse extends MessageResponse {
  proposal: Proposal;
}

// Pagamento (simulado) que conclui o serviço: o produtor informa o total. Nenhum dinheiro é movimentado.
export interface Payment {
  id: number;
  service_id: number;
  farmer_id: number;
  worker_id: number;
  value: number;
  status: PaymentStatus;
  insertion_date: string;
}

// POST /farmers/services/:id/payment
export interface PaymentInput {
  value: number; // total em R$, maior que zero
}

export interface PaymentResponse extends ServiceResponse {
  payment: Payment;
}

export interface ApplicationResponse extends MessageResponse {
  application: ServiceApplication;
}

// PATCH /farmers/services/:id/analyze: o aceite também devolve o serviço (agora In Progress).
export type AnalyzeResponse = ApplicationResponse | (ApplicationResponse & ServiceResponse);
