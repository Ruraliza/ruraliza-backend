// Gerador de IDs incrementais por entidade (em memória).
// TODO(db): ao migrar para banco, o ID passa a ser gerado pelo próprio banco (serial/identity).
export type EntityName = 'farmer' | 'farm' | 'worker' | 'service' | 'application' | 'payment';

const counters: Record<EntityName, number> = {
  farmer: 0,
  farm: 0,
  worker: 0,
  service: 0,
  application: 0,
  payment: 0
};

export function nextId(entity: EntityName): number {
  counters[entity] += 1;
  return counters[entity];
}
