// Progresso dos trabalhadores nas trilhas de qualificação (ainda sem rotas).
export type TrackProgressStatus = 'Pendente' | 'Em Andamento' | 'Concluído';

export interface TrackProgress {
  id: number;
  qualification_track_id: number;
  worker_id: number; // adaptado de contractor_id
  workload_done: number; // horas já concluídas
  status: TrackProgressStatus;
  insertion_date: string;
}

// Array em memória para guardar o progresso dos trabalhadores nas trilhas.
export const trackProgresses: TrackProgress[] = [];
