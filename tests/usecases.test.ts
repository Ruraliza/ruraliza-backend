// Testes das regras de negócio direto nos casos de uso (sem HTTP), com repositórios em memória
// e relógio fixo injetados pelo container.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type Container, createContainer } from '../src/container';
import type { Result } from '../src/domain/result';
import { InMemoryRepository } from '../src/infra/memory/InMemoryRepository';

const NOW = '2026-01-01T00:00:00.000Z';

function setup(): Container {
  return createContainer({ clock: { now: () => NOW } });
}

// Falha o teste se o resultado não for sucesso; devolve o valor já tipado.
function unwrap<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`esperava sucesso, veio ${result.kind}: ${result.message}`);
  return result.value;
}

async function farmerWithFarm(c: Container): Promise<{ farmerId: number; farmId: number }> {
  const farmer = unwrap(await c.useCases.farmers.create({ email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725' }));
  const farm = unwrap(await c.useCases.farms.create(farmer.id, { address: 'Sítio', city: 'Três Rios', state: 'RJ' }));
  return { farmerId: farmer.id, farmId: farm.id };
}

async function worker(c: Container, email: string, cpf: string): Promise<number> {
  const w = unwrap(await c.useCases.workers.create({ email, name: email, phone: '1', cpf, certificates: null, experience: null }));
  return w.id;
}

async function openService(c: Container, farmerId: number, farmId: number): Promise<number> {
  const s = unwrap(await c.useCases.services.request({ farmer_id: farmerId, farm_id: farmId, name: 'Capina', category: 'Manutenção', duration: 4, price: 200 }));
  return s.id;
}

describe('HiringUseCases', () => {
  it('desistir depois do aceite devolve o serviço e só as candidaturas recusadas pelo aceite', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const [w1, w2, w3] = [
      await worker(c, 'w1@exemplo.com', '11144477735'),
      await worker(c, 'w2@exemplo.com', '39053344705'),
      await worker(c, 'w3@exemplo.com', '93541134780')
    ];
    const a1 = unwrap(await c.useCases.hiring.apply(serviceId, w1));
    const a2 = unwrap(await c.useCases.hiring.apply(serviceId, w2));
    const a3 = unwrap(await c.useCases.hiring.apply(serviceId, w3));

    unwrap(await c.useCases.hiring.analyze(serviceId, { application_id: a3.id, action: 'Reject' }));
    const accepted = unwrap(await c.useCases.hiring.analyze(serviceId, { application_id: a1.id, action: 'Accept' }));
    assert.equal(accepted.service?.status, 'In Progress');

    const withdrawn = unwrap(await c.useCases.hiring.withdraw(serviceId, w1));
    assert.equal(withdrawn.undone, 'service');
    assert.equal(withdrawn.service.status, 'Pending');
    assert.equal(withdrawn.service.worker_id, null);

    const apps = await c.repos.applications.find({ service_id: serviceId });
    assert.deepEqual(apps.map((a) => [a.id, a.status, a.auto_rejected]), [
      [a2.id, 'Pending', undefined], // recusada pelo aceite: volta
      [a3.id, 'Rejected', undefined] // recusada pelo produtor: continua
    ]);
  });

  it('pagamento só em serviço em andamento, e conclui o serviço', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');

    const early = await c.useCases.hiring.pay(serviceId);
    assert.equal(early.ok ? 'ok' : early.kind, 'conflict');

    const app = unwrap(await c.useCases.hiring.apply(serviceId, w));
    unwrap(await c.useCases.hiring.analyze(serviceId, { application_id: app.id, action: 'Accept' }));
    const { service, payment } = unwrap(await c.useCases.hiring.pay(serviceId));
    assert.equal(service.status, 'Completed');
    assert.equal(payment.value, 200);
    assert.equal(payment.worker_id, w);
    assert.equal(payment.insertion_date, NOW);
  });
});

describe('FarmUseCases', () => {
  it('remover fazenda arquiva, e o serviço encerrado continua mostrando a fazenda', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);

    const blocked = await c.useCases.farms.delete(farmerId, farmId);
    assert.equal(blocked.ok ? 'ok' : blocked.kind, 'conflict');

    unwrap(await c.useCases.services.cancel(serviceId));
    unwrap(await c.useCases.farms.delete(farmerId, farmId));

    assert.deepEqual(unwrap(await c.useCases.farms.list(farmerId)), []);
    assert.deepEqual(unwrap(await c.useCases.farmers.get(farmerId)).farms, []);
    const service = unwrap(await c.useCases.services.get(serviceId));
    assert.equal(service.farm.deleted_at, NOW);
  });
});

describe('FarmerUseCases', () => {
  it('não remove produtor com serviço em andamento; depois do pagamento remove em cascata', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const app = unwrap(await c.useCases.hiring.apply(serviceId, w));
    unwrap(await c.useCases.hiring.analyze(serviceId, { application_id: app.id, action: 'Accept' }));

    const blocked = await c.useCases.farmers.delete(farmerId);
    assert.equal(blocked.ok ? 'ok' : blocked.kind, 'conflict');

    unwrap(await c.useCases.hiring.pay(serviceId));
    unwrap(await c.useCases.farmers.delete(farmerId));

    assert.equal(await c.repos.farmers.findById(farmerId), undefined);
    assert.deepEqual(await c.repos.farms.find({ farmer_id: farmerId }), []);
    assert.deepEqual(await c.repos.services.find({ farmer_id: farmerId }), []);
    assert.deepEqual(await c.repos.applications.find({ service_id: serviceId }), []);
    assert.equal((await c.repos.payments.find({ service_id: serviceId })).length, 1); // histórico fica
  });

  it('e-mail e CPF são únicos por tipo de perfil', async () => {
    const c = setup();
    unwrap(await c.useCases.farmers.create({ email: 'a@exemplo.com', name: 'A', phone: '1', cpf: '52998224725' }));

    const sameEmail = await c.useCases.farmers.create({ email: 'a@exemplo.com', name: 'B', phone: '1', cpf: '11144477735' });
    const sameCpf = await c.useCases.farmers.create({ email: 'b@exemplo.com', name: 'B', phone: '1', cpf: '52998224725' });
    assert.equal(sameEmail.ok ? '' : sameEmail.message, 'Já existe um cadastro com este e-mail.');
    assert.equal(sameCpf.ok ? '' : sameCpf.message, 'Já existe um cadastro com este CPF.');

    // Outro tipo de perfil pode repetir o CPF.
    unwrap(await c.useCases.workers.create({ email: 'a@exemplo.com', name: 'A', phone: '1', cpf: '52998224725', certificates: null, experience: null }));
  });
});

describe('InMemoryRepository', () => {
  it('devolve cópias: alterar sem update não persiste', async () => {
    const repo = new InMemoryRepository<{ id: number; name: string }, 'name'>(['name'], (data, id) => ({ id, ...data }));
    const created = await repo.create({ name: 'a' });

    created.name = 'mudado';
    assert.equal((await repo.findById(created.id))?.name, 'a');

    await repo.update(created);
    assert.equal((await repo.findById(created.id))?.name, 'mudado');
    assert.deepEqual(await repo.find({ name: 'mudado' }), [{ id: created.id, name: 'mudado' }]);
  });
});
