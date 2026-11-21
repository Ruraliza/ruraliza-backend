import { findAccountOf } from '#modules/accounts';
import type { CatalogCheck } from '#modules/hiring';
import type { WorkerReputation } from '#modules/reviews';
import { SERVICE_STATUS, type Service, isExpired } from '#modules/services';
import type { Worker } from '#modules/workers';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { JobPreferencesRecord } from '../domain/job-preferences';
import { type JobPlace, type WorkerMatch, matchWorker } from '../domain/match';
import type { CatalogWorker } from '../matching.contract';
import { type MatchingDeps, interestsOf } from './matching-deps';

export const CATALOG_LIMIT = 20;

interface Entry {
  worker: Worker;
  reputation: WorkerReputation | undefined;
  verified: boolean;
  match: WorkerMatch;
}

// Catálogo de prestadores de uma vaga: quem deixou o catálogo ligado e escolheu a categoria da vaga, dentro do
// raio de "perto de mim" que marcou. Ficam de fora o próprio produtor (conta com os dois perfis) e quem já se
// candidatou, foi recusado ou foi convidado para a vaga. Ordem: os sinais de matchWorker (os mesmos das vagas
// para você, no sentido inverso). É montado a cada leitura: quem desliga o catálogo sai na hora.
export class CatalogUseCase implements CatalogCheck {
  constructor(private readonly deps: MatchingDeps) {}

  async execute({ serviceId }: { serviceId: number }): Promise<Result<CatalogWorker[]>> {
    const service = await this.deps.services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    if (service.status !== SERVICE_STATUS.PENDING) return conflict('O catálogo só fica disponível enquanto a vaga está aberta.');
    if (isExpired(service, this.deps.clock.now())) return conflict('O prazo desta vaga terminou: o catálogo não está mais disponível.');

    const entries = await this.entries(service, await this.deps.jobPreferences.find({ catalog: true }));
    entries.sort((a, b) => b.match.score - a.match.score || a.worker.id - b.worker.id);
    return ok(entries.slice(0, CATALOG_LIMIT).flatMap(toCatalogWorker));
  }

  // Se o trabalhador está agora no catálogo da vaga (conferido de novo a cada convite).
  async listed(service: Service, workerId: number): Promise<boolean> {
    if (service.status !== SERVICE_STATUS.PENDING || isExpired(service, this.deps.clock.now())) return false;
    const [preferences] = await this.deps.jobPreferences.find({ worker_id: workerId, catalog: true });
    return preferences !== undefined && (await this.entries(service, [preferences])).length === 1;
  }

  private async entries(service: Service, candidates: readonly JobPreferencesRecord[]): Promise<Entry[]> {
    const { farms, applications, invites, accounts, workerReputation, workerVerification } = this.deps;
    const interested = candidates.filter((p) => p.categories.includes(service.category));
    if (interested.length === 0) return [];

    const excluded = new Set([
      ...(await applications.find({ service_id: service.id })).map((a) => a.worker_id),
      ...(await invites.find({ service_id: service.id })).map((i) => i.worker_id)
    ]);
    const ownWorker = (await findAccountOf(accounts, 'farmer', service.farmer_id))?.worker_id ?? null;
    const eligible = interested.filter((p) => !excluded.has(p.worker_id) && p.worker_id !== ownWorker);
    const ids = eligible.map((p) => p.worker_id);
    const reputations = await workerReputation.forWorkers(ids);
    const verified = await workerVerification.verifiedWorkers(ids);

    const farm = await farms.findById(service.farm_id);
    const place: JobPlace = { category: service.category, latitude: farm?.latitude ?? null, longitude: farm?.longitude ?? null };
    const entries: Entry[] = [];
    for (const preferences of eligible) {
      const worker = await this.deps.workers.findById(preferences.worker_id);
      if (!worker) continue;
      const facts = { reputation: reputations.get(worker.id), verified: verified.has(worker.id) };
      const match = matchWorker(await interestsOf(this.deps, worker.id, preferences), place, facts);
      if (match) entries.push({ worker, ...facts, match });
    }
    return entries;
  }
}

// Só o que a lista de candidatos já mostra, mais os motivos (com a faixa de distância): sem CPF, telefone,
// e-mail nem localização.
function toCatalogWorker({ worker, reputation, verified, match }: Entry): CatalogWorker[] {
  if (!reputation) return [];
  const { id, name, photo_url, bio, experience, certificates } = worker;
  return [{ id, name, photo_url, bio, experience, certificates, reputation, verified, reasons: match.reasons }];
}
