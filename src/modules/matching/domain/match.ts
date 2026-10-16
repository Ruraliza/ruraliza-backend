import type { FarmReputation } from '#modules/reviews';
import { distanceKm } from '#shared/domain/geo';
import type { JobPreferencesNear } from '../matching.contract';

// O que se sabe do trabalhador para sugerir vagas.
export interface WorkerInterests {
  chosen: ReadonlySet<string>; // categorias que ele escolheu
  tracks: ReadonlyMap<string, { title: string; completed: boolean }>; // categoria → trilha que ele faz (a concluída vence)
  history: ReadonlySet<string>; // categorias das vagas em que já se candidatou
  near: JobPreferencesNear | null;
}

// O que se sabe da vaga (o ponto da fazenda não sai daqui: só a distância arredondada).
export interface JobFacts {
  category: string;
  latitude: number | null;
  longitude: number | null;
  reputation: FarmReputation | undefined;
  farmerVerified: boolean;
}

export interface JobMatch {
  score: number;
  reasons: string[];
  distanceKm: number | null;
  // A categoria combina com o que ele escolheu ou estuda (o que vale para avisar na hora).
  explicit: boolean;
}

const GOOD_RATING = 4.5;

// Sugestão de uma vaga para um trabalhador, ou null se não tem nada a ver com ele. Fora do raio de
// "perto de mim" nunca entra. Com alguma categoria conhecida (escolhida, de trilha ou do histórico), a
// categoria precisa combinar; sem nenhuma, vale só a distância.
export function matchJob(interests: WorkerInterests, job: JobFacts): JobMatch | null {
  let distance: number | null = null;
  if (interests.near && job.latitude !== null && job.longitude !== null) {
    distance = Math.round(distanceKm(interests.near, { latitude: job.latitude, longitude: job.longitude }));
    if (distance > interests.near.radius_km) return null;
  }

  const reasons: string[] = [];
  let score = 0;
  const chosen = interests.chosen.has(job.category);
  const track = interests.tracks.get(job.category);
  if (chosen) {
    score += 3;
    reasons.push(`Você escolheu ${job.category}`);
  }
  if (track) {
    score += track.completed ? 3 : 1.5;
    reasons.push(track.completed ? `Você concluiu a trilha ${track.title}` : `Você está fazendo a trilha ${track.title}`);
  }
  const fromHistory = !chosen && !track && interests.history.has(job.category);
  if (fromHistory) {
    score += 1;
    reasons.push('Parecida com vagas em que você se candidatou');
  }

  const knowsCategories = interests.chosen.size > 0 || interests.tracks.size > 0 || interests.history.size > 0;
  if (score === 0 && (knowsCategories || distance === null)) return null;

  if (distance !== null && interests.near) {
    score += 2 * (1 - distance / interests.near.radius_km);
    reasons.push(distance < 1 ? 'Pertinho de você' : `A ${distance} km de você`);
  }
  if (job.reputation && job.reputation.count >= 2 && (job.reputation.average ?? 0) >= GOOD_RATING) {
    score += 0.5;
    reasons.push('Fazenda bem avaliada');
  }
  if (job.farmerVerified) {
    score += 0.5;
    reasons.push('Produtor verificado');
  }
  return { score, reasons, distanceKm: distance, explicit: chosen || track !== undefined || !knowsCategories };
}
