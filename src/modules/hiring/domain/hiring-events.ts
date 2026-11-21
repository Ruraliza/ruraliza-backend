import type { Service } from '#modules/services';
import type { WorkerReputation } from '#modules/reviews';
import type { Proposal } from '../hiring.contract';

// Portas que a contratação usa sem depender de quem implementa (o container liga em src/container.ts).

// Etapas da contratação que outros módulos acompanham (a conversa fecha na recusa, no aceite de outro e na
// desistência, reabre quando o aceito desiste e ganha prazo no pagamento). Chamadas depois que tudo foi salvo.
export interface HiringEvents {
  // `autoRejected`: os trabalhadores cujas candidaturas foram recusadas pelo aceite.
  accepted(service: Service, autoRejected: readonly number[]): Promise<void>;
  rejected(service: Service, workerId: number): Promise<void>;
  // `restored`: os trabalhadores cujas candidaturas voltaram a Pending (só quando o aceito desiste).
  withdrawn(service: Service, workerId: number, restored: readonly number[]): Promise<void>;
  // Pago (e concluído): a conversa fica aberta por mais alguns dias.
  paid(service: Service): Promise<void>;
  // Cada proposta (e a resposta a ela) aparece na conversa, em tempo real, com push para o outro lado.
  proposed(proposal: Proposal): Promise<void>;
  proposalAnswered(proposal: Proposal): Promise<void>;
}

export const NO_HIRING_EVENTS: HiringEvents = {
  accepted: () => Promise.resolve(),
  rejected: () => Promise.resolve(),
  withdrawn: () => Promise.resolve(),
  paid: () => Promise.resolve(),
  proposed: () => Promise.resolve(),
  proposalAnswered: () => Promise.resolve()
};

// A conversa em que a proposta é feita (módulo de conversas). As propostas só valem com ela aberta.
export interface NegotiationChat {
  id: number;
  service_id: number;
  worker_id: number;
  open: boolean;
}

export interface NegotiationChats {
  find(chatId: number): Promise<NegotiationChat | null>;
}

// Reputação publicada dos candidatos (módulo de avaliações).
export interface WorkerReputationReader {
  forWorkers(workerIds: readonly number[]): Promise<Map<number, WorkerReputation>>;
}
