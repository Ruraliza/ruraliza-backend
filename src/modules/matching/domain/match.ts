import type { FarmReputation, WorkerReputation } from '#modules/reviews';
import { distanceKm } from '#shared/domain/geo';
import type { JobPreferencesNear } from '../matching.contract';

// O que se sabe do trabalhador para sugerir vagas.
export interface WorkerInterests {
  chosen: ReadonlySet<string>; // categorias que ele escolheu
  tracks: ReadonlyMap<string, { title: string; completed: boolean }>; // categoria → trilha que ele faz (a concluída vence)
  history: ReadonlySet<string>; // categorias das vagas em que já se candidatou
  near: JobPreferencesNear | null;
}

// Onde e de que categoria é a vaga (o ponto da fazenda não sai daqui: só a distância arredondada).
export interface JobPlace {
  category: string;
  latitude: number | null;
  longitude: number | null;
}

// O que se sabe da vaga para o trabalhador.
export interface JobFacts extends JobPlace {
  reputation: FarmReputation | undefined;
  farmerVerified: boolean;
}

// O que se sabe do trabalhador para o produtor (catálogo da vaga).
export interface WorkerFacts {
  reputation: WorkerReputation | undefined;
  verified: boolean;
}

export interface JobMatch {
  score: number;
  reasons: string[];
  distanceKm: number | null;
  // A categoria combina com o que ele escolheu ou estuda (o que vale para avisar na hora).
  explicit: boolean;
}

// Pesos de cada sinal, os mesmos nos dois sentidos (vagas para o trabalhador e catálogo para o produtor).
const WEIGHT = { chosen: 3, trackCompleted: 3, trackOngoing: 1.5, history: 1, distance: 2, rating: 0.5, verified: 0.5 };
const GOOD_RATING = 4.5;

// Os sinais entre um trabalhador e uma vaga, ou null se a vaga fica fora do raio de "perto de mim" dele.
interface Signals {
  chosen: boolean;
  track: { title: string; completed: boolean } | undefined;
  history: boolean;
  distance: number | null;
  distanceScore: number;
}

function matchSignals(interests: WorkerInterests, place: JobPlace): Signals | null {
  let distance: number | null = null;
  let distanceScore = 0;
  if (interests.near && place.latitude !== null && place.longitude !== null) {
    distance = Math.round(distanceKm(interests.near, { latitude: place.latitude, longitude: place.longitude }));
    if (distance > interests.near.radius_km) return null;
    distanceScore = WEIGHT.distance * (1 - distance / interests.near.radius_km);
  }
  return {
    chosen: interests.chosen.has(place.category),
    track: interests.tracks.get(place.category),
    history: interests.history.has(place.category),
    distance,
    distanceScore
  };
}

function trackScore(track: Signals['track']): number {
  if (!track) return 0;
  return track.completed ? WEIGHT.trackCompleted : WEIGHT.trackOngoing;
}

function wellRated(reputation: { average: number | null; count: number } | undefined): reputation is { average: number; count: number } {
  return reputation !== undefined && reputation.count >= 2 && (reputation.average ?? 0) >= GOOD_RATING;
}

// Sugestão de uma vaga para um trabalhador, ou null se não tem nada a ver com ele. Fora do raio de
// "perto de mim" nunca entra. Com alguma categoria conhecida (escolhida, de trilha ou do histórico), a
// categoria precisa combinar; sem nenhuma, vale só a distância.
export function matchJob(interests: WorkerInterests, job: JobFacts): JobMatch | null {
  const signals = matchSignals(interests, job);
  if (!signals) return null;
  const { chosen, track, distance } = signals;

  const reasons: string[] = [];
  let score = 0;
  if (chosen) {
    score += WEIGHT.chosen;
    reasons.push(`Você escolheu ${job.category}`);
  }
  if (track) {
    score += trackScore(track);
    reasons.push(track.completed ? `Você concluiu a trilha ${track.title}` : `Você está fazendo a trilha ${track.title}`);
  }
  const fromHistory = !chosen && !track && signals.history;
  if (fromHistory) {
    score += WEIGHT.history;
    reasons.push('Parecida com vagas em que você se candidatou');
  }
  const knowsCategories = interests.chosen.size > 0 || interests.tracks.size > 0 || interests.history.size > 0;
  if (score === 0 && (knowsCategories || distance === null)) return null;
  if (distance !== null) {
    score += signals.distanceScore;
    reasons.push(distance < 1 ? 'Pertinho de você' : `A ${distance} km de você`);
  }
  if (wellRated(job.reputation)) {
    score += WEIGHT.rating;
    reasons.push('Fazenda bem avaliada');
  }
  if (job.farmerVerified) {
    score += WEIGHT.verified;
    reasons.push('Produtor verificado');
  }
  return { score, reasons, distanceKm: distance, explicit: chosen || track !== undefined || !knowsCategories };
}

export interface WorkerMatch {
  score: number;
  reasons: string[];
}

// No catálogo, a distância sai só em faixas: com o km exato de várias fazendas, o produtor triangularia a
// região do trabalhador. A ordem também usa a faixa (o limite de cima), para não vazar o km pela posição.
const DISTANCE_BANDS: readonly { upTo: number; label: string }[] = [
  { upTo: 5, label: 'Até 5 km da fazenda' },
  { upTo: 15, label: 'De 5 a 15 km da fazenda' },
  { upTo: 30, label: 'De 15 a 30 km da fazenda' },
  { upTo: 60, label: 'De 30 a 60 km da fazenda' }
];
const BEYOND_BANDS = { upTo: Infinity, label: 'Mais de 60 km da fazenda' };

export function distanceBand(km: number): { upTo: number; label: string } {
  return DISTANCE_BANDS.find((band) => km <= band.upTo) ?? BEYOND_BANDS;
}

function rating(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// O mesmo cruzamento no sentido inverso: um trabalhador no catálogo de uma vaga, com os motivos para o
// produtor. Só entra quem escolheu a categoria da vaga e está dentro do próprio raio; trilha, histórico,
// faixa de distância, nota e selo ordenam.
export function matchWorker(interests: WorkerInterests, job: JobPlace, worker: WorkerFacts): WorkerMatch | null {
  const signals = matchSignals(interests, job);
  if (!signals?.chosen) return null;
  const { track, distance } = signals;

  const reasons = [`Escolheu ${job.category}`];
  let score = WEIGHT.chosen;
  if (track) {
    score += trackScore(track);
    reasons.push(track.completed ? `Concluiu a trilha ${track.title}` : `Está fazendo a trilha ${track.title}`);
  }
  if (signals.history) {
    score += WEIGHT.history;
    reasons.push(`Já se candidatou a vagas de ${job.category}`);
  }
  if (distance !== null && interests.near) {
    const band = distanceBand(distance);
    score += WEIGHT.distance * Math.max(0, 1 - band.upTo / interests.near.radius_km);
    reasons.push(band.label);
  }
  if (wellRated(worker.reputation)) {
    score += WEIGHT.rating;
    reasons.push(`Nota ${rating(worker.reputation.average)}`);
  }
  if (worker.verified) {
    score += WEIGHT.verified;
    reasons.push('Verificado');
  }
  return { score, reasons };
}
