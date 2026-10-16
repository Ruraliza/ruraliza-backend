import type { FarmerRepository } from '#modules/farmers';
import type { FarmRepository } from '#modules/farms';
import { APPLICATION_STATUS, type ApplicationRepository, type PaymentRepository } from '#modules/hiring';
import { SERVICE_STATUS, type FarmReputationReader, type Service, type ServiceRepository, isExpired } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import { dayOf } from '#shared/domain/dates';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { FarmerStats, FarmerStatsCategory, FarmerStatsMonth, FarmerStatsPerson, FarmerStatsRating } from '../farm-stats.contract';

export interface FarmStatsDeps {
  farmers: FarmerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  payments: PaymentRepository;
  applications: ApplicationRepository;
  workers: WorkerRepository;
  reputation: FarmReputationReader;
  clock: Clock;
}

const MONTHS = 6;
const PEOPLE_SHOWN = 20;
const REMOVED_PROFILE = '(perfil removido)';

// Os 6 últimos meses (AAAA-MM), do mais antigo para o atual.
function lastMonths(today: string): string[] {
  const [year = 0, month = 1] = today.split('-').map(Number);
  return Array.from({ length: MONTHS }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1 - (MONTHS - 1 - i), 1));
    return date.toISOString().slice(0, 7);
  });
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

function weighted(values: readonly { value: number | null; count: number }[]): number | null {
  const known = values.filter((v): v is { value: number; count: number } => v.value !== null && v.count > 0);
  const total = known.reduce((sum, v) => sum + v.count, 0);
  return total === 0 ? null : round1(known.reduce((sum, v) => sum + v.value * v.count, 0) / total);
}

// Painel do produtor: horas e serviços concluídos, quanto pagou, quem já trabalhou com ele (e quem voltou),
// a nota das fazendas, os últimos 6 meses e as categorias. Tudo do produtor, em todas as fazendas.
// TODO(db): vira algumas consultas com GROUP BY (mês, categoria, trabalhador).
export class GetFarmerStatsUseCase {
  constructor(private readonly deps: FarmStatsDeps) {}

  async execute({ farmerId }: { farmerId: number }): Promise<Result<FarmerStats>> {
    const { farmers, farms, services, payments, applications, workers, reputation, clock } = this.deps;
    if (!(await farmers.findById(farmerId))) return notFound('Produtor não encontrado.');
    const now = clock.now();
    const own = await services.find({ farmer_id: farmerId });

    const completed: { service: Service; paidAt: string; paid: number }[] = [];
    for (const service of own.filter((s) => s.status === SERVICE_STATUS.COMPLETED)) {
      const [payment] = await payments.find({ service_id: service.id });
      completed.push({ service, paidAt: payment?.insertion_date ?? service.insertion_date, paid: payment?.value ?? service.price });
    }

    const months = new Map<string, FarmerStatsMonth>(lastMonths(dayOf(now)).map((month) => [month, { month, services: 0, hours: 0, paid: 0 }]));
    const categories = new Map<string, FarmerStatsCategory>();
    const people = new Map<number, Omit<FarmerStatsPerson, 'name' | 'photo_url'>>();
    for (const { service, paidAt, paid } of completed) {
      const month = months.get(dayOf(paidAt).slice(0, 7));
      if (month) {
        month.services++;
        month.hours += service.duration;
        month.paid += paid;
      }
      const category = categories.get(service.category) ?? { category: service.category, services: 0, hours: 0 };
      categories.set(service.category, { ...category, services: category.services + 1, hours: category.hours + service.duration });
      if (service.worker_id !== null) {
        const person = people.get(service.worker_id) ?? { worker_id: service.worker_id, services: 0, hours: 0, last_service_at: paidAt };
        people.set(service.worker_id, {
          ...person, services: person.services + 1, hours: person.hours + service.duration,
          last_service_at: paidAt > person.last_service_at ? paidAt : person.last_service_at
        });
      }
    }

    const history = await Promise.all([...people.values()].map(async (person): Promise<FarmerStatsPerson> => {
      const worker = await workers.findById(person.worker_id);
      return { ...person, name: worker?.name ?? REMOVED_PROFILE, photo_url: worker?.photo_url ?? null };
    }));
    history.sort((a, b) => b.last_service_at.localeCompare(a.last_service_at));

    const open = own.filter((s) => s.status === SERVICE_STATUS.PENDING && !isExpired(s, now));
    let pendingApplications = 0;
    for (const service of open) pendingApplications += (await applications.find({ service_id: service.id, status: APPLICATION_STATUS.PENDING })).length;

    return ok({
      services_completed: completed.length,
      hours_completed: completed.reduce((sum, c) => sum + c.service.duration, 0),
      total_paid: completed.reduce((sum, c) => sum + c.paid, 0),
      people_count: history.length,
      returning_people: history.filter((p) => p.services >= 2).length,
      rating: await this.rating(farmerId, farms, reputation),
      open_jobs: open.length,
      pending_applications: pendingApplications,
      months: [...months.values()],
      categories: [...categories.values()].sort((a, b) => b.hours - a.hours || b.services - a.services),
      people: history.slice(0, PEOPLE_SHOWN)
    });
  }

  private async rating(farmerId: number, farms: FarmRepository, reputation: FarmReputationReader): Promise<FarmerStatsRating | null> {
    const ids = (await farms.find({ farmer_id: farmerId })).map((f) => f.id);
    const reputations = [...(await reputation.forFarms(ids)).values()].filter((r) => r.count > 0);
    const count = reputations.reduce((sum, r) => sum + r.count, 0);
    const average = weighted(reputations.map((r) => ({ value: r.average, count: r.count })));
    if (count === 0 || average === null) return null;
    return {
      average,
      count,
      infrastructure: weighted(reputations.map((r) => ({ value: r.infrastructure, count: r.count }))),
      conditions: weighted(reputations.map((r) => ({ value: r.conditions, count: r.count }))),
      as_described: weighted(reputations.map((r) => ({ value: r.as_described, count: r.count })))
    };
  }
}
