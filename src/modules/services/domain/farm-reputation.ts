import type { FarmReputation } from '#modules/reviews';

// Reputação publicada das fazendas (módulo de avaliações; o container liga).
export interface FarmReputationReader {
  forFarms(farmIds: readonly number[]): Promise<Map<number, FarmReputation>>;
}
