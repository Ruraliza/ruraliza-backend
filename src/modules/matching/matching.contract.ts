import type { WorkerReputation } from '#modules/reviews';
import type { OpenService } from '#modules/services';
import type { MessageResponse } from '#shared/contracts/api';

// Vagas para você (issues #23 e #16): o trabalhador diz o que quer fazer e onde está; o app sugere as vagas
// que combinam (também pelas trilhas que ele faz e pelas vagas em que já se candidatou) e, se ele quiser,
// avisa na hora quando abre uma vaga assim, mais um resumo semanal.

// "Perto de mim": a região aproximada (o app guarda cerca de 1 km de precisão) e até onde a pessoa vai.
export interface JobPreferencesNear {
  latitude: number;
  longitude: number;
  radius_km: number; // 5 a 300
}

// GET e PUT /workers/:id/job-preferences (o PUT troca tudo)
export interface JobPreferences {
  categories: string[]; // categorias de serviço que a pessoa quer (GET /api/categories)
  near: JobPreferencesNear | null;
  alerts: boolean; // avisar quando abrir vaga que combina (e o resumo semanal)
  catalog: boolean; // aparecer no catálogo das vagas das categorias escolhidas (começa ligado)
}

// O PUT aceita sem `catalog` (apps antigos): fica como estava.
export type JobPreferencesInput = Omit<JobPreferences, 'catalog'> & { catalog?: boolean };

export interface JobPreferencesResponse extends MessageResponse {
  preferences: JobPreferences;
}

// GET /workers/:id/recommended-jobs: a vaga e por que ela combina.
export interface RecommendedJob extends OpenService {
  reasons: string[]; // ex.: "Você escolheu Colheita", "Você concluiu a trilha Manejo de gado", "A 12 km de você"
  distance_km: number | null; // distância aproximada até a fazenda, em linha reta (só com "perto de mim")
}

// GET /farmers/services/:id/catalog: um trabalhador que escolheu a categoria da vaga e deixou o catálogo ligado.
// Só o que a lista de candidatos já mostra; nada de CPF, telefone, e-mail ou localização (só a faixa de distância).
export interface CatalogWorker {
  id: number; // worker_id, para convidar
  name: string;
  photo_url: string | null;
  bio: string | null;
  experience: string | null;
  certificates: string | null;
  reputation: WorkerReputation;
  verified: boolean;
  // ex.: "Escolheu Colheita", "Concluiu a trilha Manejo de gado", "De 5 a 15 km da fazenda", "Nota 4,8", "Verificado".
  // A distância vem só em faixas (até 5, 5 a 15, 15 a 30, 30 a 60 e mais de 60 km), e só quando o trabalhador marcou "perto de mim".
  reasons: string[];
}
