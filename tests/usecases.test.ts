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
  const w = unwrap(await c.useCases.workers.create({ email, name: email, phone: '1', cpf, bio: null, certificates: null, courses: null, experience: null }));
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

  it('candidatura recusada impede nova candidatura do mesmo trabalhador ao mesmo serviço', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');

    const app = unwrap(await c.useCases.hiring.apply(serviceId, w));
    unwrap(await c.useCases.hiring.analyze(serviceId, { application_id: app.id, action: 'Reject' }));

    const reapply = await c.useCases.hiring.apply(serviceId, w);
    assert.equal(reapply.ok ? 'ok' : reapply.kind, 'conflict');
  });

  it('vaga recusada some da busca (searchOpen) para o trabalhador recusado, mas continua para os demais', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w1 = await worker(c, 'w1@exemplo.com', '11144477735');
    const w2 = await worker(c, 'w2@exemplo.com', '39053344705');

    const app = unwrap(await c.useCases.hiring.apply(serviceId, w1));
    unwrap(await c.useCases.hiring.analyze(serviceId, { application_id: app.id, action: 'Reject' }));

    const forRejected = await c.useCases.services.searchOpen({ worker_id: w1 });
    assert.equal(forRejected.some((s) => s.id === serviceId), false);

    const forOther = await c.useCases.services.searchOpen({ worker_id: w2 });
    assert.equal(forOther.some((s) => s.id === serviceId), true);
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
    unwrap(await c.useCases.workers.create({ email: 'a@exemplo.com', name: 'A', phone: '1', cpf: '52998224725', bio: null, certificates: null, courses: null, experience: null }));
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

describe('Validade das vagas (expires_at)', () => {
  // Relógio controlável: começa em 30/09 às 12h de Brasília (15h UTC).
  function setupAt(): { c: Container; setNow: (iso: string) => void } {
    let now = '2026-09-30T15:00:00.000Z';
    const c = createContainer({ clock: { now: () => now } });
    return { c, setNow: (iso) => { now = iso; } };
  }

  it('vale até o fim do último dia no horário de Brasília, depois sai da busca e recusa candidaturas', async () => {
    const { c, setNow } = setupAt();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const service = unwrap(await c.useCases.services.request({
      farmer_id: farmerId, farm_id: farmId, name: 'Colheita', category: 'Colheita', duration: 8, price: 300, expires_at: '2026-10-01'
    }));
    const w = await worker(c, 'w@exemplo.com', '11144477735');

    // 01/10 às 23h de Brasília (02/10 02h UTC): ainda é o último dia.
    setNow('2026-10-02T02:00:00.000Z');
    assert.ok((await c.useCases.services.searchOpen()).some((s) => s.id === service.id));

    // 02/10 à 00h01 de Brasília: venceu.
    setNow('2026-10-02T03:01:00.000Z');
    assert.equal((await c.useCases.services.searchOpen()).some((s) => s.id === service.id), false);
    const late = await c.useCases.hiring.apply(service.id, w);
    assert.equal(late.ok ? '' : late.kind, 'conflict');
    assert.equal((await c.useCases.services.get(service.id)).ok, true); // continua existindo, Pending

    // Renovar exige data de hoje em diante; renovada, volta às vagas.
    const past = await c.useCases.services.update(service.id, { expires_at: '2026-10-01' });
    assert.equal(past.ok ? '' : past.kind, 'invalid');
    unwrap(await c.useCases.services.update(service.id, { expires_at: '2026-10-10' }));
    assert.ok((await c.useCases.services.searchOpen()).some((s) => s.id === service.id));
    unwrap(await c.useCases.hiring.apply(service.id, w));
  });
});

describe('Fotos', () => {
  const PNG = async (): Promise<Uint8Array> => {
    const sharp = (await import('sharp')).default;
    return new Uint8Array(await sharp({ create: { width: 20, height: 20, channels: 3, background: '#00552a' } }).png().toBuffer());
  };

  it('remover o produtor apaga do store a foto de perfil e as fotos das fazendas', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const farmer = unwrap(await c.useCases.photos.setFarmerPhoto(farmerId, await PNG()));
    const farm = unwrap(await c.useCases.photos.addFarmPhoto(farmerId, farmId, await PNG()));
    const ids = [c.images.idFromUrl(farmer.photo_url ?? ''), farm.photos[0]?.id].filter((id): id is string => id !== undefined);
    assert.equal(ids.length, 2);

    unwrap(await c.useCases.farmers.delete(farmerId));
    for (const id of ids) assert.equal(await c.images.get(id), undefined);
  });

  it('recusa bytes que não são imagem', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const result = await c.useCases.photos.setWorkerPhoto(w, new TextEncoder().encode('texto'));
    assert.equal(result.ok ? '' : result.kind, 'invalid');
    assert.equal((await c.repos.workers.findById(w))?.photo_url, null);
  });
});
