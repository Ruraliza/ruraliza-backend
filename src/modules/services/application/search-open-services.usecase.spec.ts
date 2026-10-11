import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { Farm } from '#modules/farms';
import type { Service } from '../service.contract';
import { type ServicesTestbed, givenApplication, givenFarm, givenFarmer, givenService, servicesTestbed } from '../testing/service-fixtures';
import { SearchOpenServicesUseCase } from './search-open-services.usecase';

describe('SearchOpenServicesUseCase', () => {
  let t: ServicesTestbed;
  let search: SearchOpenServicesUseCase;
  let farm: Farm;

  beforeEach(async () => {
    t = servicesTestbed();
    search = new SearchOpenServicesUseCase(t);
    farm = await givenFarm(t, await givenFarmer(t));
  });

  const ids = (jobs: readonly { id: number }[]): number[] => jobs.map((j) => j.id);

  it('só vagas Pending, com cidade/UF da fazenda e sem o endereço', async () => {
    const open = await givenService(t, farm);
    for (const status of ['In Progress', 'Completed', 'Cancelled'] as const) await givenService(t, farm, { status });

    const jobs = await search.execute();

    assert.deepEqual(ids(jobs), [open.id]);
    assert.deepEqual(jobs[0]?.farm, { city: 'Três Rios', state: 'RJ', photos: [] });
  });

  it('a validade vale até o fim do último dia no horário de Brasília', async () => {
    const service = await givenService(t, farm, { expires_at: '2026-10-01' });

    t.setNow('2026-10-02T02:59:00.000Z'); // 01/10 às 23h59 em Brasília
    assert.deepEqual(ids(await search.execute()), [service.id]);

    t.setNow('2026-10-02T03:00:00.000Z'); // 02/10 à 0h em Brasília
    assert.deepEqual(ids(await search.execute()), []);
  });

  it('busca por texto ignora acento e maiúscula e procura também na cidade; todas as palavras precisam aparecer', async () => {
    const coffee = await givenService(t, farm, { name: 'Colheita de Café', category: 'Colheita' });
    await givenService(t, farm, { name: 'Conserto de cerca' });

    assert.deepEqual(ids(await search.execute({ q: 'CAFE' })), [coffee.id]);
    assert.deepEqual(ids(await search.execute({ q: 'cafe tres rios' })), [coffee.id]);
    assert.deepEqual(ids(await search.execute({ q: 'cafe paraiba' })), []);
  });

  it('filtra por categoria, carga horária e dia de publicação', async () => {
    const short = await givenService(t, farm, { category: 'Plantio', duration: 4, insertion_date: '2026-09-28T15:00:00.000Z' });
    const long = await givenService(t, farm, { category: 'Plantio', duration: 16, insertion_date: '2026-09-30T15:00:00.000Z' });
    await givenService(t, farm, { category: 'Colheita', duration: 8 });

    assert.deepEqual(ids(await search.execute({ category: 'Plantio' })).sort(), [short.id, long.id].sort());
    assert.deepEqual(ids(await search.execute({ category: 'Plantio', min_hours: 8 })), [long.id]);
    assert.deepEqual(ids(await search.execute({ category: 'Plantio', max_hours: 8 })), [short.id]);
    assert.deepEqual(ids(await search.execute({ category: 'Plantio', from: '2026-09-29' })), [long.id]);
    assert.deepEqual(ids(await search.execute({ category: 'Plantio', to: '2026-09-29' })), [short.id]);
  });

  it('com worker_id, esconde as vagas em que o trabalhador foi recusado', async () => {
    const rejectedHere = await givenService(t, farm);
    const pendingHere = await givenService(t, farm);
    await givenApplication(t, rejectedHere, 7, 'Rejected');
    await givenApplication(t, pendingHere, 7);

    assert.deepEqual(ids(await search.execute({ worker_id: 7 })), [pendingHere.id]);
    assert.deepEqual(ids(await search.execute({ worker_id: 8 })).sort(), [rejectedHere.id, pendingHere.id].sort());
  });

  it('ordena por mais recentes (padrão), por valor e por duração', async () => {
    const at = (day: number): string => `2026-09-${String(day).padStart(2, '0')}T15:00:00.000Z`;
    const a: Service = await givenService(t, farm, { price: 300, duration: 8, insertion_date: at(28) });
    const b: Service = await givenService(t, farm, { price: 100, duration: 16, insertion_date: at(30) });
    const c: Service = await givenService(t, farm, { price: 200, duration: 4, insertion_date: at(29) });

    assert.deepEqual(ids(await search.execute()), [b.id, c.id, a.id]);
    assert.deepEqual(ids(await search.execute({ sort: 'price_desc' })), [a.id, c.id, b.id]);
    assert.deepEqual(ids(await search.execute({ sort: 'price_asc' })), [b.id, c.id, a.id]);
    assert.deepEqual(ids(await search.execute({ sort: 'duration_asc' })), [c.id, a.id, b.id]);
    assert.deepEqual(ids(await search.execute({ sort: 'duration_desc' })), [b.id, a.id, c.id]);
  });
});
