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
}

export interface JobPreferencesResponse extends MessageResponse {
  preferences: JobPreferences;
}

// GET /workers/:id/recommended-jobs: a vaga e por que ela combina.
export interface RecommendedJob extends OpenService {
  reasons: string[]; // ex.: "Você escolheu Colheita", "Você concluiu a trilha Manejo de gado", "A 12 km de você"
  distance_km: number | null; // distância aproximada até a fazenda, em linha reta (só com "perto de mim")
}
