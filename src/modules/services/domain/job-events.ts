import type { Service } from '../service.contract';

// Quem acompanha as vagas (o container liga): a publicação avisa quem quer vagas novas, sem esperar;
// o cancelamento encerra as conversas da vaga.
export interface JobEvents {
  jobPublished(service: Service): void;
  jobCancelled(service: Service): Promise<void>;
}

export const NO_JOB_EVENTS: JobEvents = { jobPublished: () => undefined, jobCancelled: () => Promise.resolve() };
