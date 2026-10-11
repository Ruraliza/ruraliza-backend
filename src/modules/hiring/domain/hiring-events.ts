import type { Service } from '#modules/services';
import type { WorkerReputation } from '#modules/reviews';

// Portas que a contratação usa sem depender de quem implementa (o container liga em src/container.ts).

// Etapas da contratação que outros módulos acompanham (ex.: a conversa abre no aceite,
// fecha na desistência e ganha prazo no pagamento). Chamadas depois que o serviço foi salvo.
export interface HiringEvents {
  accepted(service: Service): Promise<void>;
  withdrawn(service: Service, workerId: number): Promise<void>; // o serviço já voltou a Pending
  paid(service: Service): Promise<void>;
}

export const NO_HIRING_EVENTS: HiringEvents = {
  accepted: () => Promise.resolve(),
  withdrawn: () => Promise.resolve(),
  paid: () => Promise.resolve()
};

// Reputação publicada dos candidatos (módulo de avaliações).
export interface WorkerReputationReader {
  forWorkers(workerIds: readonly number[]): Promise<Map<number, WorkerReputation>>;
}
