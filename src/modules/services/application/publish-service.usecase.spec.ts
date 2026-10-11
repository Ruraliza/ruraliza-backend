import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import type { ServiceInput } from '../service.contract';
import { NOW, type ServicesTestbed, givenFarm, givenFarmer, servicesTestbed } from '../testing/service-fixtures';
import { PublishServiceUseCase } from './publish-service.usecase';

describe('PublishServiceUseCase', () => {
  let t: ServicesTestbed;
  let publish: PublishServiceUseCase;

  beforeEach(() => {
    t = servicesTestbed();
    publish = new PublishServiceUseCase(t);
  });

  async function input(changes: Partial<ServiceInput> = {}): Promise<ServiceInput> {
    const farmer = await givenFarmer(t);
    const farm = await givenFarm(t, farmer);
    return { farmer_id: farmer.id, farm_id: farm.id, name: 'Colheita', category: 'Colheita', duration: 8, price: 300, ...changes };
  }

  it('publica Pending, sem trabalhador nem pagamento, com a data do relógio', async () => {
    const data = await input();

    const service = unwrap(await publish.execute(data));

    assert.deepEqual(service, {
      id: service.id, farmer_id: data.farmer_id, farm_id: data.farm_id, worker_id: null, payment_id: null,
      name: 'Colheita', description: null, category: 'Colheita', duration: 8, price: 300,
      expires_at: null, status: 'Pending', insertion_date: NOW
    });
    assert.deepEqual(await t.services.findById(service.id), service);
  });

  it('aceita validade de hoje; recusa a de ontem', async () => {
    unwrap(await publish.execute(await input({ expires_at: '2026-09-30' })));

    t = servicesTestbed();
    publish = new PublishServiceUseCase(t);
    const yesterday = await publish.execute(await input({ expires_at: '2026-09-29' }));
    assert.equal(yesterday.ok ? 'ok' : yesterday.kind, 'invalid');
    assert.deepEqual(await t.services.find(), []);
  });

  it('produtor inexistente ou fazenda arquivada dá not_found', async () => {
    const data = await input();

    const noFarmer = await publish.execute({ ...data, farmer_id: 99 });
    assert.equal(noFarmer.ok ? 'ok' : noFarmer.kind, 'not_found');

    const farm = await t.farms.findById(data.farm_id);
    if (farm) await t.farms.update({ ...farm, deleted_at: NOW });
    const archived = await publish.execute(data);
    assert.equal(archived.ok ? 'ok' : archived.kind, 'not_found');
  });

  it('fazenda de outro produtor dá invalid', async () => {
    const data = await input();
    const bia = await givenFarmer(t, 'bia@exemplo.com', '11144477735');

    const result = await publish.execute({ ...data, farmer_id: bia.id });

    assert.equal(result.ok ? 'ok' : result.kind, 'invalid');
  });
});
