import { WORKER_HOME_URL, type PushMessage, workerJobUrl } from '#modules/notifications';
import type { Service } from '#modules/services';
import { DIGEST_INTERVAL_DAYS, MAX_ALERTS_PER_DAY } from '../domain/job-alert';
import { type JobMatch, matchJob } from '../domain/match';
import type { RecommendedJob } from '../matching.contract';
import { type MatchingDeps, interestsOf, ownFarmerId } from './matching-deps';
import type { RecommendJobsUseCase } from './recommend-jobs.usecase';

const DAY_MS = 86_400_000;

function money(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
}

function hours(value: number): string {
  return `${value.toLocaleString('pt-BR')} ${value === 1 ? 'hora' : 'horas'}`;
}

function newJobMessage(service: Service, place: string, match: JobMatch): PushMessage {
  const distance = match.distanceKm === null ? '' : ` (a ${match.distanceKm} km)`;
  return {
    title: match.distanceKm === null ? 'Vaga nova para você' : 'Vaga nova perto de você',
    body: `${service.name} em ${place}${distance}: ${hours(service.duration)} por ${money(service.price)}.`,
    url: workerJobUrl(service.id)
  };
}

function digestMessage(jobs: readonly RecommendedJob[]): PushMessage {
  const [first] = jobs;
  const others = jobs.length - 1;
  return {
    title: `Encontramos ${jobs.length} ${jobs.length === 1 ? 'vaga' : 'vagas'} para você`,
    body: `${first?.name ?? 'Vaga'} em ${first?.farm.city ?? ''}${others > 0 ? ` e mais ${others}` : ''}. Veja as vagas recomendadas.`,
    url: WORKER_HOME_URL
  };
}

// Avisos de vaga (issue #16): quem ligou os avisos fica sabendo na hora quando abre uma vaga que combina
// com o que escolheu ou estuda (e dentro do raio, se marcou "perto de mim"). No máximo 3 por dia e nunca
// a mesma vaga duas vezes; o resto aparece nas recomendações e no resumo semanal.
export class JobAlerts {
  private readonly pending = new Set<Promise<void>>();

  constructor(private readonly deps: MatchingDeps, private readonly recommend: RecommendJobsUseCase) {}

  // Ligado na publicação de vagas (o container passa para o módulo de serviços). Não espera.
  jobPublished(service: Service): void {
    const task = this.notifyNewJob(service)
      .catch((error: unknown) => console.error('Falha ao avisar sobre vaga nova:', error))
      .finally(() => this.pending.delete(task));
    this.pending.add(task);
  }

  // Espera os avisos em andamento (para os testes).
  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.all(this.pending);
  }

  async notifyNewJob(service: Service): Promise<void> {
    const { jobPreferences, jobAlerts, farms, reputation, verification, clock, push } = this.deps;
    const farm = await farms.findById(service.farm_id);
    if (!farm) return;
    const facts = {
      category: service.category,
      latitude: farm.latitude,
      longitude: farm.longitude,
      reputation: (await reputation.forFarms([farm.id])).get(farm.id),
      farmerVerified: (await verification.verifiedFarmers([service.farmer_id])).has(service.farmer_id)
    };
    const now = clock.now();
    const dayAgo = new Date(Date.parse(now) - DAY_MS).toISOString();
    for (const preferences of await jobPreferences.find({ alerts: true })) {
      const workerId = preferences.worker_id;
      if ((await ownFarmerId(this.deps, workerId)) === service.farmer_id) continue;
      const match = matchJob(await interestsOf(this.deps, workerId, preferences), facts);
      if (!match?.explicit) continue;
      const sent = await jobAlerts.find({ worker_id: workerId });
      if (sent.some((a) => a.service_id === service.id) || sent.filter((a) => a.sent_at > dayAgo).length >= MAX_ALERTS_PER_DAY) continue;
      await jobAlerts.create({ worker_id: workerId, service_id: service.id, sent_at: now });
      push.notify('worker', workerId, newJobMessage(service, `${farm.city}, ${farm.state}`, match));
    }
  }

  // Resumo semanal: "Encontramos 3 vagas para você". Vai para quem ligou os avisos, uma vez a cada 7 dias,
  // e só quando há vaga recomendada. Devolve quantos resumos saíram.
  async sendWeeklyDigest(): Promise<number> {
    const { jobPreferences, clock, push } = this.deps;
    const now = clock.now();
    const due = new Date(Date.parse(now) - DIGEST_INTERVAL_DAYS * DAY_MS).toISOString();
    let sent = 0;
    for (const preferences of await jobPreferences.find({ alerts: true })) {
      if (preferences.last_digest_at !== null && preferences.last_digest_at > due) continue;
      const jobs = await this.recommend.execute({ workerId: preferences.worker_id, limit: 3 });
      if (!jobs.ok || jobs.value.length === 0) continue;
      push.notify('worker', preferences.worker_id, digestMessage(jobs.value));
      await jobPreferences.update({ ...preferences, last_digest_at: now });
      sent++;
    }
    return sent;
  }
}
