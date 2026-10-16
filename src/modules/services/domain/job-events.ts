import type { Service } from '../service.contract';

// Quem quer saber quando uma vaga é publicada (os avisos de vaga nova; o container liga). Não espera.
export interface JobEvents {
  jobPublished(service: Service): void;
}

export const NO_JOB_EVENTS: JobEvents = { jobPublished: () => undefined };
