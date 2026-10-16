import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createInMemoryFarmerRepository } from '#modules/farmers';
import { createInMemoryFarmRepository } from '#modules/farms';
import { createInMemoryApplicationRepository, createInMemoryPaymentRepository } from '#modules/hiring';
import { type Service, createInMemoryServiceRepository } from '#modules/services';
import { createInMemoryWorkerRepository } from '#modules/workers';
import { fixedClock } from '#shared/testing/fixed-clock';
import { unwrap } from '#shared/testing/unwrap';
import { type FarmStatsDeps, GetFarmerStatsUseCase } from './get-farmer-stats.usecase';

const NOW = '2026-10-16T15:00:00.000Z';

describe('Painel da fazenda', () => {
  let deps: FarmStatsDeps;
  let stats: GetFarmerStatsUseCase;

  const service = (changes: Partial<Service>): Promise<Service> => deps.services.create({
    farmer_id: 1, farm_id: 1, payment_id: null, worker_id: null, name: 'Serviço', description: null, category: 'Colheita',
    duration: 8, price: 400, expires_at: null, status: 'Pending', insertion_date: '2026-06-01T12:00:00.000Z', ...changes
  });
  const completed = async (workerId: number, paidAt: string, changes: Partial<Service> = {}): Promise<void> => {
    const done = await service({ status: 'Completed', worker_id: workerId, ...changes });
    await deps.payments.create({ service_id: done.id, farmer_id: 1, worker_id: workerId, value: done.price, status: 'Completed', insertion_date: paidAt });
  };

  beforeEach(async () => {
    deps = {
      farmers: createInMemoryFarmerRepository(),
      farms: createInMemoryFarmRepository(),
      services: createInMemoryServiceRepository(),
      payments: createInMemoryPaymentRepository(),
      applications: createInMemoryApplicationRepository(),
      workers: createInMemoryWorkerRepository(),
      reputation: {
        forFarms: (ids) => Promise.resolve(new Map(ids.map((id) => [id, id === 1
          ? { average: 5, count: 3, score: 4.5, infrastructure: 5, conditions: 5, as_described: 5 }
          : { average: 4, count: 1, score: 3.6, infrastructure: 4, conditions: 3, as_described: null }])))
      },
      clock: fixedClock(NOW)
    };
    await deps.farmers.create({ email: 'joao@exemplo.com', name: 'João', phone: '1', cpf: '52998224725', farms: [], photo_url: null, insertion_date: NOW });
    const farm = { farmer_id: 1, address: 'Sítio', city: 'Três Rios', state: 'RJ', latitude: null, longitude: null, photos: [], insertion_date: NOW };
    await deps.farms.create(farm);
    await deps.farms.create(farm);
    const worker = { phone: '1', bio: null, certificates: null, courses: null, experience: null, photo_url: null, resume_url: null, insertion_date: NOW };
    await deps.workers.create({ ...worker, email: 'maria@exemplo.com', name: 'Maria', cpf: '11144477735' });
    await deps.workers.create({ ...worker, email: 'pedro@exemplo.com', name: 'Pedro', cpf: '71428793860' });
    stats = new GetFarmerStatsUseCase(deps);
  });

  it('soma horas, serviços e pagamentos só do que foi concluído, por mês e por categoria', async () => {
    await completed(1, '2026-10-02T12:00:00.000Z', { duration: 10, price: 500 });
    await completed(1, '2026-08-20T12:00:00.000Z', { duration: 6, price: 300, category: 'Manejo de gado' });
    await completed(2, '2026-03-10T12:00:00.000Z', { duration: 4, price: 200 }); // fora dos 6 meses, mas entra no total
    await service({ status: 'In Progress', worker_id: 2 });

    const s = unwrap(await stats.execute({ farmerId: 1 }));

    assert.deepEqual([s.services_completed, s.hours_completed, s.total_paid], [3, 20, 1000]);
    assert.deepEqual(s.months.map((m) => [m.month, m.hours, m.paid]), [
      ['2026-05', 0, 0], ['2026-06', 0, 0], ['2026-07', 0, 0], ['2026-08', 6, 300], ['2026-09', 0, 0], ['2026-10', 10, 500]
    ]);
    assert.deepEqual(s.categories, [{ category: 'Colheita', services: 2, hours: 14 }, { category: 'Manejo de gado', services: 1, hours: 6 }]);
  });

  it('lista quem já passou por aqui, o mais recente primeiro, e conta quem voltou', async () => {
    await completed(2, '2026-09-01T12:00:00.000Z');
    await completed(1, '2026-10-01T12:00:00.000Z');
    await completed(1, '2026-10-10T12:00:00.000Z');
    await deps.workers.delete(2);

    const s = unwrap(await stats.execute({ farmerId: 1 }));

    assert.deepEqual(s.people.map((p) => [p.name, p.services, p.hours, p.last_service_at]), [
      ['Maria', 2, 16, '2026-10-10T12:00:00.000Z'],
      ['(perfil removido)', 1, 8, '2026-09-01T12:00:00.000Z']
    ]);
    assert.deepEqual([s.people_count, s.returning_people], [2, 1]);
  });

  it('a nota junta as fazendas pesando pela quantidade de avaliações; vagas abertas e candidaturas esperando', async () => {
    const open = await service({});
    await service({ expires_at: '2026-10-01' }); // vencida: não conta
    await deps.applications.create({ service_id: open.id, worker_id: 1, status: 'Pending', insertion_date: NOW });
    await deps.applications.create({ service_id: open.id, worker_id: 2, status: 'Rejected', insertion_date: NOW });

    const s = unwrap(await stats.execute({ farmerId: 1 }));

    assert.deepEqual(s.rating, { average: 4.8, count: 4, infrastructure: 4.8, conditions: 4.5, as_described: 5 });
    assert.deepEqual([s.open_jobs, s.pending_applications], [1, 1]);
  });

  it('produtor sem nada ainda: tudo zerado e sem nota', async () => {
    const empty = new GetFarmerStatsUseCase({ ...deps, reputation: { forFarms: () => Promise.resolve(new Map()) } });

    const s = unwrap(await empty.execute({ farmerId: 1 }));

    assert.deepEqual([s.services_completed, s.rating, s.people, s.months.length], [0, null, [], 6]);
    assert.equal((await stats.execute({ farmerId: 9 })).ok, false);
  });
});
