// Trilhas de qualificação disponíveis (ainda sem rotas).
export interface QualificationTrack {
  id: number;
  name: string; // ex.: "Operação de Maquinário Pesado"
  description: string;
  workload: number; // carga horária total
  category: string; // ex.: "Maquinário"
  insertion_date: string;
}

// Array em memória para guardar as trilhas de qualificação disponíveis.
export const qualificationTracks: QualificationTrack[] = [];
