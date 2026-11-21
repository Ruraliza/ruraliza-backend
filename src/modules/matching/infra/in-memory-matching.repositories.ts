import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { CatalogNoticeStore } from '../domain/catalog-notice';
import type { JobAlertRepository } from '../domain/job-alert';
import type { JobPreferencesRepository } from '../domain/job-preferences';

export function createInMemoryJobPreferencesRepository(): JobPreferencesRepository {
  return new InMemoryRepository(['worker_id', 'alerts', 'catalog'], (data, id) => ({ id, ...data }));
}

export function createInMemoryJobAlertRepository(): JobAlertRepository {
  return new InMemoryRepository(['worker_id', 'service_id'], (data, id) => ({ id, ...data }));
}

// Em memória não há contas de antes do catálogo (o banco começa vazio a cada subida): `pending` é para os testes.
export function createInMemoryCatalogNoticeStore(pending: readonly number[] = []): CatalogNoticeStore {
  const waiting = new Set(pending);
  return {
    claimPending() {
      const claimed = [...waiting].sort((a, b) => a - b);
      waiting.clear();
      return Promise.resolve(claimed);
    }
  };
}
