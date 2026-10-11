// Testes das regras de negócio direto nos casos de uso (sem HTTP), com repositórios em memória
// e relógio fixo injetados pelo container.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type Container, createContainer } from '../src/container';
import type { Result } from '#shared/domain/result';
import { createHmacSessionTokens } from '#shared/infra/crypto/node-crypto';
import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';

const NOW = '2026-01-01T00:00:00.000Z';
const PASSWORD = 'senha-forte-1';

function setup(): Container {
  return createContainer({ clock: { now: () => NOW } });
}

// Falha o teste se o resultado não for sucesso; devolve o valor já tipado.
function unwrap<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`esperava sucesso, veio ${result.kind}: ${result.message}`);
  return result.value;
}

async function farmerWithFarm(c: Container): Promise<{ farmerId: number; farmId: number }> {
  const { farmer } = unwrap(await c.useCases.farmers.create({ email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', password: PASSWORD }));
  const farm = unwrap(await c.useCases.farms.createFarm.execute({ farmerId: farmer.id, input: { address: 'Sítio', city: 'Três Rios', state: 'RJ', latitude: -22.1165, longitude: -43.2092 } }));
  return { farmerId: farmer.id, farmId: farm.id };
}

async function worker(c: Container, email: string, cpf: string): Promise<number> {
  const { worker: w } = unwrap(await c.useCases.workers.create({ email, name: email, phone: '1', cpf, password: PASSWORD, bio: null, certificates: null, courses: null, experience: null }));
  return w.id;
}

async function openService(c: Container, farmerId: number, farmId: number): Promise<number> {
  const s = unwrap(await c.useCases.services.publishService.execute({ farmer_id: farmerId, farm_id: farmId, name: 'Capina', category: 'Manutenção', duration: 4, price: 200 }));
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
    const a1 = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w1 }));
    const a2 = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w2 }));
    const a3 = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w3 }));

    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: a3.id, action: 'Reject' }));
    const accepted = unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: a1.id, action: 'Accept' }));
    assert.equal(accepted.service?.status, 'In Progress');

    const withdrawn = unwrap(await c.useCases.hiring.withdrawFromService.execute({ serviceId: serviceId, workerId: w1 }));
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

    const app = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: app.id, action: 'Reject' }));

    const reapply = await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w });
    assert.equal(reapply.ok ? 'ok' : reapply.kind, 'conflict');
  });

  it('vaga recusada some da busca (searchOpen) para o trabalhador recusado, mas continua para os demais', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w1 = await worker(c, 'w1@exemplo.com', '11144477735');
    const w2 = await worker(c, 'w2@exemplo.com', '39053344705');

    const app = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w1 }));
    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: app.id, action: 'Reject' }));

    const forRejected = await c.useCases.services.searchOpenServices.execute({ worker_id: w1 });
    assert.equal(forRejected.some((s) => s.id === serviceId), false);

    const forOther = await c.useCases.services.searchOpenServices.execute({ worker_id: w2 });
    assert.equal(forOther.some((s) => s.id === serviceId), true);
  });

  it('pagamento só em serviço em andamento, e conclui o serviço', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');

    const early = await c.useCases.hiring.payService.execute({ serviceId: serviceId });
    assert.equal(early.ok ? 'ok' : early.kind, 'conflict');

    const app = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: app.id, action: 'Accept' }));
    const { service, payment } = unwrap(await c.useCases.hiring.payService.execute({ serviceId: serviceId }));
    assert.equal(service.status, 'Completed');
    assert.equal(payment.value, 200);
    assert.equal(payment.worker_id, w);
    assert.equal(payment.insertion_date, NOW);
  });
});

// As regras de cada caso de uso de fazenda estão em src/modules/farms/application/*.spec.ts;
// aqui fica só o fluxo que passa pelos serviços.
describe('Fazendas com serviços', () => {
  it('remover fazenda arquiva, e o serviço encerrado continua mostrando a fazenda', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);

    const blocked = await c.useCases.farms.deleteFarm.execute({ farmerId, farmId });
    assert.equal(blocked.ok ? 'ok' : blocked.kind, 'conflict');

    unwrap(await c.useCases.services.cancelService.execute({ serviceId: serviceId }));
    unwrap(await c.useCases.farms.deleteFarm.execute({ farmerId, farmId }));

    assert.deepEqual(unwrap(await c.useCases.farms.listFarms.execute({ farmerId })), []);
    assert.deepEqual(unwrap(await c.useCases.farmers.get(farmerId)).farms, []);
    const service = unwrap(await c.useCases.services.getService.execute({ serviceId: serviceId }));
    assert.equal(service.farm.deleted_at, NOW);
  });
});

describe('Localização da fazenda para o trabalhador', () => {
  it('só o trabalhador aceito no serviço recebe as coordenadas', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const accepted = await worker(c, 'a@exemplo.com', '11144477735');
    const other = await worker(c, 'b@exemplo.com', '39053344705');

    // Vaga aberta: ninguém vê o ponto.
    const [open] = await c.useCases.services.searchOpenServices.execute();
    assert.equal(open?.farm.latitude, undefined);
    assert.equal(unwrap(await c.useCases.services.getOpenService.execute({ serviceId: serviceId, viewerWorkerId: accepted })).farm.latitude, undefined);

    const app = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: accepted }));
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: other }));
    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: app.id, action: 'Accept' }));

    const seen = unwrap(await c.useCases.services.getOpenService.execute({ serviceId: serviceId, viewerWorkerId: accepted })).farm;
    assert.deepEqual([seen.latitude, seen.longitude], [-22.1165, -43.2092]);
    assert.equal(unwrap(await c.useCases.services.getOpenService.execute({ serviceId: serviceId })).farm.latitude, undefined);
    assert.equal(unwrap(await c.useCases.services.getOpenService.execute({ serviceId: serviceId, viewerWorkerId: other })).farm.latitude, undefined);

    const [assigned] = unwrap(await c.useCases.workers.listServices(accepted));
    assert.equal(assigned?.farm.longitude, -43.2092);
    const applications = unwrap(await c.useCases.workers.listApplications(other));
    assert.equal(applications[0]?.service.farm.latitude, undefined);
  });

  it('fazenda sem ponto marcado (null) não expõe coordenadas', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const farm = await c.repos.farms.findById(farmId);
    assert.ok(farm);
    await c.repos.farms.update({ ...farm, latitude: null, longitude: null });
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'a@exemplo.com', '11144477735');
    const app = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: app.id, action: 'Accept' }));

    assert.equal('latitude' in unwrap(await c.useCases.services.getOpenService.execute({ serviceId: serviceId, viewerWorkerId: w })).farm, false);
  });
});

describe('FarmerUseCases', () => {
  it('não remove produtor com serviço em andamento; depois do pagamento remove em cascata', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const app = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: app.id, action: 'Accept' }));

    const blocked = await c.useCases.farmers.delete(farmerId);
    assert.equal(blocked.ok ? 'ok' : blocked.kind, 'conflict');

    unwrap(await c.useCases.hiring.payService.execute({ serviceId: serviceId }));
    unwrap(await c.useCases.farmers.delete(farmerId));

    assert.equal(await c.repos.farmers.findById(farmerId), undefined);
    assert.deepEqual(await c.repos.farms.find({ farmer_id: farmerId }), []);
    assert.deepEqual(await c.repos.services.find({ farmer_id: farmerId }), []);
    assert.deepEqual(await c.repos.applications.find({ service_id: serviceId }), []);
    assert.equal((await c.repos.payments.find({ service_id: serviceId })).length, 1); // histórico fica
  });

  it('não se candidata ao serviço que publicou com o perfil de produtor da mesma conta', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const accountId = unwrap(await c.useCases.auth.login({ email: 'ana@exemplo.com', password: PASSWORD })).account_id;
    const session = unwrap(await c.useCases.accounts.addProfile(accountId, { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' }));

    const own = await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: session.id });
    assert.equal(own.ok ? '' : own.message, 'Você não pode se candidatar a um serviço que você mesmo publicou.');
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId, workerId: await worker(c, 'outro@exemplo.com', '11144477735') }));
  });
});

describe('Contas', () => {
  const workerProfile = { name: 'Ana', phone: '1', cpf: '52998224725', bio: null, certificates: null, courses: null, experience: null };

  it('um e-mail e um CPF abrem uma conta só, em qualquer tipo de perfil', async () => {
    const c = setup();
    unwrap(await c.useCases.farmers.create({ email: 'a@exemplo.com', name: 'A', phone: '1', cpf: '52998224725', password: PASSWORD }));

    const sameEmail = await c.useCases.workers.create({ ...workerProfile, email: 'a@exemplo.com', cpf: '11144477735', password: PASSWORD });
    const sameCpf = await c.useCases.farmers.create({ email: 'b@exemplo.com', name: 'B', phone: '1', cpf: '52998224725', password: PASSWORD });
    const sameCpfOtherRole = await c.useCases.workers.create({ ...workerProfile, email: 'b@exemplo.com', password: PASSWORD });
    for (const r of [sameEmail, sameCpf, sameCpfOtherRole]) assert.equal(r.ok ? '' : r.kind, 'conflict');
    assert.equal(sameEmail.ok ? '' : sameEmail.message, 'Já existe uma conta com este e-mail. Entre com ela e ative o outro perfil pelo menu.');
  });

  it('o segundo perfil entra na mesma conta, com a mesma senha, e o login abre o último painel', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const first = unwrap(await c.useCases.auth.login({ email: 'ana@exemplo.com', password: PASSWORD }));
    assert.deepEqual(first, { account_id: first.account_id, role: 'farmer', id: farmerId, profiles: { farmer: farmerId, worker: null } });

    const both = unwrap(await c.useCases.accounts.addProfile(first.account_id, { role: 'worker', ...workerProfile, experience: '3 anos' }));
    assert.equal(both.role, 'worker');
    assert.deepEqual(both.profiles, { farmer: farmerId, worker: both.id });
    const created = await c.repos.workers.findById(both.id);
    assert.deepEqual([created?.email, created?.experience], ['ana@exemplo.com', '3 anos']);

    const again = await c.useCases.accounts.addProfile(first.account_id, { role: 'worker', ...workerProfile });
    assert.equal(again.ok ? '' : again.kind, 'conflict');

    // A mesma senha abre o último painel usado; trocar de painel muda o próximo login.
    assert.equal(unwrap(await c.useCases.auth.login({ email: 'ana@exemplo.com', password: PASSWORD })).role, 'worker');
    assert.equal(unwrap(await c.useCases.accounts.setActiveRole(first.account_id, 'farmer')).id, farmerId);
    assert.equal(unwrap(await c.useCases.auth.login({ email: 'ana@exemplo.com', password: PASSWORD })).role, 'farmer');
  });

  it('o segundo perfil não pode usar o CPF de outra conta', async () => {
    const c = setup();
    await farmerWithFarm(c);
    await worker(c, 'w@exemplo.com', '11144477735');
    const accountId = unwrap(await c.useCases.auth.login({ email: 'ana@exemplo.com', password: PASSWORD })).account_id;

    const taken = await c.useCases.accounts.addProfile(accountId, { role: 'worker', ...workerProfile, cpf: '11144477735' });
    assert.equal(taken.ok ? '' : taken.kind, 'conflict');
  });

  it('só troca para um painel que a conta tem', async () => {
    const c = setup();
    await farmerWithFarm(c);
    const accountId = unwrap(await c.useCases.auth.login({ email: 'ana@exemplo.com', password: PASSWORD })).account_id;

    const missing = await c.useCases.accounts.setActiveRole(accountId, 'worker');
    assert.equal(missing.ok ? '' : missing.kind, 'not_found');
    const ghost = await c.useCases.accounts.setActiveRole(999, 'farmer');
    assert.equal(ghost.ok ? '' : ghost.kind, 'not_found');
  });

  it('trocar o e-mail num perfil vale para a conta e para o outro perfil', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const accountId = unwrap(await c.useCases.auth.login({ email: 'ana@exemplo.com', password: PASSWORD })).account_id;
    const workerId = unwrap(await c.useCases.accounts.addProfile(accountId, { role: 'worker', ...workerProfile })).id;
    await worker(c, 'w@exemplo.com', '11144477735');

    const taken = await c.useCases.farmers.update(farmerId, { email: 'w@exemplo.com' });
    assert.equal(taken.ok ? '' : taken.kind, 'conflict');

    unwrap(await c.useCases.farmers.update(farmerId, { email: 'nova@exemplo.com' }));
    assert.equal((await c.repos.workers.findById(workerId))?.email, 'nova@exemplo.com');
    unwrap(await c.useCases.auth.login({ email: 'nova@exemplo.com', password: PASSWORD }));
  });

  it('remover um perfil mantém a conta com o outro; remover os dois apaga a conta', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const accountId = unwrap(await c.useCases.auth.login({ email: 'ana@exemplo.com', password: PASSWORD })).account_id;
    const workerId = unwrap(await c.useCases.accounts.addProfile(accountId, { role: 'worker', ...workerProfile })).id;

    unwrap(await c.useCases.workers.delete(workerId));
    assert.deepEqual(unwrap(await c.useCases.auth.login({ email: 'ana@exemplo.com', password: PASSWORD })).profiles, { farmer: farmerId, worker: null });

    unwrap(await c.useCases.farmers.delete(farmerId));
    assert.deepEqual(await c.repos.accounts.find(), []);
    assert.equal((await c.useCases.auth.login({ email: 'ana@exemplo.com', password: PASSWORD })).ok, false);
  });
});

describe('AuthUseCases', () => {
  // Relógio controlável, para a validade do token de redefinição.
  function setupAt(): { c: Container; setNow: (iso: string) => void } {
    let now = NOW;
    const c = createContainer({ clock: { now: () => now } });
    return { c, setNow: (iso) => { now = iso; } };
  }

  it('o cadastro guarda só o hash da senha, fora do perfil, e o login confere a senha', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);

    const farmer = await c.repos.farmers.findById(farmerId);
    assert.equal(farmer && 'password' in farmer, false);
    const [account] = await c.repos.accounts.find({ farmer_id: farmerId });
    assert.ok(account && !account.password_hash.includes(PASSWORD));

    assert.equal(unwrap(await c.useCases.auth.login({ email: 'ana@exemplo.com', password: PASSWORD })).id, farmerId);
    const wrong = await c.useCases.auth.login({ email: 'ana@exemplo.com', password: 'outra-senha' });
    const unknown = await c.useCases.auth.login({ email: 'ninguem@exemplo.com', password: PASSWORD });
    for (const r of [wrong, unknown]) assert.equal(r.ok ? '' : r.message, 'E-mail ou senha incorretos.');
  });

  it('esqueci a senha: o token vale uma vez, troca a senha e o anterior deixa de valer', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');

    const missing = await c.useCases.auth.requestReset({ email: 'ninguem@exemplo.com' });
    assert.equal(missing.ok ? '' : missing.kind, 'not_found');

    const first = unwrap(await c.useCases.auth.requestReset({ email: 'w@exemplo.com' })).reset_token;
    const second = unwrap(await c.useCases.auth.requestReset({ email: 'w@exemplo.com' })).reset_token;
    const stale = await c.useCases.auth.resetPassword({ token: first, password: 'nova-senha-1' });
    assert.equal(stale.ok ? '' : stale.kind, 'invalid'); // o pedido novo invalida o anterior

    const reset = unwrap(await c.useCases.auth.resetPassword({ token: second, password: 'nova-senha-1' }));
    assert.deepEqual([reset.role, reset.id], ['worker', w]);
    const reused = await c.useCases.auth.resetPassword({ token: second, password: 'outra-senha-2' });
    assert.equal(reused.ok ? '' : reused.kind, 'invalid');

    assert.equal((await c.useCases.auth.login({ email: 'w@exemplo.com', password: PASSWORD })).ok, false);
    unwrap(await c.useCases.auth.login({ email: 'w@exemplo.com', password: 'nova-senha-1' }));
  });

  it('o token de redefinição expira em 30 minutos', async () => {
    const { c, setNow } = setupAt();
    await worker(c, 'w@exemplo.com', '11144477735');
    const { reset_token } = unwrap(await c.useCases.auth.requestReset({ email: 'w@exemplo.com' }));

    setNow('2026-01-01T00:30:00.000Z');
    const late = await c.useCases.auth.resetPassword({ token: reset_token, password: 'nova-senha-1' });
    assert.equal(late.ok ? '' : late.kind, 'invalid');
  });

  it('trocar a senha logado exige a senha atual, cancela a redefinição pendente e vale para os dois perfis', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const { reset_token } = unwrap(await c.useCases.auth.requestReset({ email: 'ana@exemplo.com' }));
    const accountId = unwrap(await c.useCases.auth.login({ email: 'ana@exemplo.com', password: PASSWORD })).account_id;
    const workerId = unwrap(await c.useCases.accounts.addProfile(accountId, { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' })).id;

    const wrong = await c.useCases.auth.changePassword('farmer', farmerId, { current_password: 'errada-123', new_password: 'nova-senha-1' });
    assert.equal(wrong.ok ? '' : wrong.kind, 'unauthorized');
    const same = await c.useCases.auth.changePassword('farmer', farmerId, { current_password: PASSWORD, new_password: PASSWORD });
    assert.equal(same.ok ? '' : same.kind, 'invalid');
    const ghost = await c.useCases.auth.changePassword('worker', 999, { current_password: PASSWORD, new_password: 'nova-senha-1' });
    assert.equal(ghost.ok ? '' : ghost.kind, 'not_found');

    unwrap(await c.useCases.auth.changePassword('farmer', farmerId, { current_password: PASSWORD, new_password: 'nova-senha-1' }));
    unwrap(await c.useCases.auth.login({ email: 'ana@exemplo.com', password: 'nova-senha-1' }));
    // A senha é da conta: a troca feita pelo perfil de produtor vale no de trabalhador.
    unwrap(await c.useCases.auth.changePassword('worker', workerId, { current_password: 'nova-senha-1', new_password: 'nova-senha-2' }));
    const pending = await c.useCases.auth.resetPassword({ token: reset_token, password: 'outra-senha-2' });
    assert.equal(pending.ok ? '' : pending.kind, 'invalid');
  });

  it('remover o único perfil remove a conta', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    unwrap(await c.useCases.workers.delete(w));
    assert.deepEqual(await c.repos.accounts.find({ worker_id: w }), []);
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
    const service = unwrap(await c.useCases.services.publishService.execute({
      farmer_id: farmerId, farm_id: farmId, name: 'Colheita', category: 'Colheita', duration: 8, price: 300, expires_at: '2026-10-01'
    }));
    const w = await worker(c, 'w@exemplo.com', '11144477735');

    // 01/10 às 23h de Brasília (02/10 02h UTC): ainda é o último dia.
    setNow('2026-10-02T02:00:00.000Z');
    assert.ok((await c.useCases.services.searchOpenServices.execute()).some((s) => s.id === service.id));

    // 02/10 à 00h01 de Brasília: venceu.
    setNow('2026-10-02T03:01:00.000Z');
    assert.equal((await c.useCases.services.searchOpenServices.execute()).some((s) => s.id === service.id), false);
    const late = await c.useCases.hiring.applyForService.execute({ serviceId: service.id, workerId: w });
    assert.equal(late.ok ? '' : late.kind, 'conflict');
    assert.equal((await c.useCases.services.getService.execute({ serviceId: service.id })).ok, true); // continua existindo, Pending

    // Renovar exige data de hoje em diante; renovada, volta às vagas.
    const past = await c.useCases.services.updateService.execute({ serviceId: service.id, changes: { expires_at: '2026-10-01' } });
    assert.equal(past.ok ? '' : past.kind, 'invalid');
    unwrap(await c.useCases.services.updateService.execute({ serviceId: service.id, changes: { expires_at: '2026-10-10' } }));
    assert.ok((await c.useCases.services.searchOpenServices.execute()).some((s) => s.id === service.id));
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: service.id, workerId: w }));
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

  it('foto de perfil sai quadrada (quadrado central, até 1000px); foto da fazenda mantém a proporção', async () => {
    const sharp = (await import('sharp')).default;
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const wide = new Uint8Array(await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#3a7d24' } }).jpeg().toBuffer());
    const small = new Uint8Array(await sharp({ create: { width: 300, height: 400, channels: 3, background: '#ee8a14' } }).png().toBuffer());
    const sizeOf = async (url: string | null | undefined): Promise<[number | undefined, number | undefined]> => {
      const image = await c.images.get(c.images.idFromUrl(url ?? '') ?? '');
      assert.ok(image);
      const { width, height } = await sharp(image.bytes).metadata();
      return [width, height];
    };

    assert.deepEqual(await sizeOf(unwrap(await c.useCases.photos.setFarmerPhoto(farmerId, wide)).photo_url), [1000, 1000]);
    assert.deepEqual(await sizeOf(unwrap(await c.useCases.photos.setFarmerPhoto(farmerId, small)).photo_url), [300, 300]);
    assert.deepEqual(await sizeOf(unwrap(await c.useCases.photos.addFarmPhoto(farmerId, farmId, wide)).photos[0]?.url), [1000, 667]);
  });

  it('recusa bytes que não são imagem', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const result = await c.useCases.photos.setWorkerPhoto(w, new TextEncoder().encode('texto'));
    assert.equal(result.ok ? '' : result.kind, 'invalid');
    assert.equal((await c.repos.workers.findById(w))?.photo_url, null);
  });
});

describe('Currículo', () => {
  const PDF = (): Uint8Array => new TextEncoder().encode('%PDF-1.4\n%%EOF\n');

  it('guarda o PDF como veio, troca apagando o anterior e some ao remover o trabalhador', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const first = unwrap(await c.useCases.resumes.setWorkerResume(w, PDF())).resume_url;
    assert.match(first ?? '', /^\/api\/documents\/.+\.pdf$/);
    const firstId = c.documents.idFromUrl(first ?? '') ?? '';
    assert.deepEqual((await c.documents.get(firstId))?.bytes, PDF());

    const second = unwrap(await c.useCases.resumes.setWorkerResume(w, PDF())).resume_url;
    assert.notEqual(second, first);
    assert.equal(await c.documents.get(firstId), undefined);

    unwrap(await c.useCases.workers.delete(w));
    assert.equal(await c.documents.get(c.documents.idFromUrl(second ?? '') ?? ''), undefined);
  });

  it('o produtor vê o currículo de quem se candidatou ao serviço', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const url = unwrap(await c.useCases.resumes.setWorkerResume(w, PDF())).resume_url;
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));

    const [application] = unwrap(await c.useCases.hiring.listServiceApplications.execute({ serviceId: serviceId }));
    assert.equal(application?.worker.resume_url, url);
  });

  it('recusa arquivo que não é PDF', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const result = await c.useCases.resumes.setWorkerResume(w, new TextEncoder().encode('texto'));
    assert.equal(result.ok ? '' : result.kind, 'invalid');
    assert.equal((await c.repos.workers.findById(w))?.resume_url, null);
  });
});

describe('Avisos em tempo real (SSE)', () => {
  // Conta quantas vezes cada tela aberta seria avisada.
  async function watch(c: Container, kind: 'service' | 'worker', id: number): Promise<{ count: () => number; stop: () => void }> {
    let calls = 0;
    const listener = (): void => { calls++; };
    const stop = unwrap(kind === 'service'
      ? await c.useCases.hiring.watchServiceApplications.execute({ serviceId: id, listener: listener })
      : await c.useCases.workers.watchApplications(id, listener));
    return { count: () => calls, stop };
  }

  it('o produtor é avisado quando alguém se candidata ou desiste', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const farmerScreen = await watch(c, 'service', serviceId);

    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    assert.equal(farmerScreen.count(), 1);
    unwrap(await c.useCases.hiring.withdrawFromService.execute({ serviceId: serviceId, workerId: w }));
    assert.equal(farmerScreen.count(), 2);

    farmerScreen.stop();
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    assert.equal(farmerScreen.count(), 2); // parou de acompanhar
  });

  it('o trabalhador é avisado quando o status das candidaturas dele muda', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const [w1, w2] = [await worker(c, 'w1@exemplo.com', '11144477735'), await worker(c, 'w2@exemplo.com', '39053344705')];
    const a1 = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w1 }));
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w2 }));
    const [screen1, screen2] = [await watch(c, 'worker', w1), await watch(c, 'worker', w2)];

    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: a1.id, action: 'Accept' }));
    assert.deepEqual([screen1.count(), screen2.count()], [1, 1]); // aceito e recusado pelo aceite

    unwrap(await c.useCases.hiring.withdrawFromService.execute({ serviceId: serviceId, workerId: w1 }));
    assert.deepEqual([screen1.count(), screen2.count()], [2, 2]); // a do 2º volta a Pending

    unwrap(await c.useCases.services.cancelService.execute({ serviceId: serviceId }));
    assert.deepEqual([screen1.count(), screen2.count()], [2, 3]); // só quem ainda tinha candidatura
  });

  it('acompanhar serviço ou trabalhador inexistente dá not_found', async () => {
    const c = setup();
    const noop = (): void => undefined;
    const service = await c.useCases.hiring.watchServiceApplications.execute({ serviceId: 999, listener: noop });
    const w = await c.useCases.workers.watchApplications(999, noop);
    assert.deepEqual([service.ok ? '' : service.kind, w.ok ? '' : w.kind], ['not_found', 'not_found']);
  });
});

describe('Notificações push', () => {
  const ENDPOINT = 'https://push.exemplo.com/abc';
  const KEYS = { p256dh: 'chave', auth: 'segredo' };

  // Grava o que seria enviado; `gone` simula inscrições revogadas no navegador.
  function pushSetup(gone: readonly string[] = []): { c: Container; sent: { endpoint: string; title: string; url: string }[] } {
    const sent: { endpoint: string; title: string; url: string }[] = [];
    const c = createContainer({
      clock: { now: () => NOW },
      push: {
        send: (sub, message) => {
          sent.push({ endpoint: sub.endpoint, title: message.title, url: message.url });
          return Promise.resolve(gone.includes(sub.endpoint) ? 'gone' : 'sent');
        }
      }
    });
    return { c, sent };
  }

  async function accountOf(c: Container, filter: { farmer_id: number } | { worker_id: number }): Promise<number> {
    const [account] = await c.repos.accounts.find(filter);
    assert.ok(account);
    return account.id;
  }

  it('candidatura avisa o produtor; aceite avisa o aceito e os recusados pelo aceite', async () => {
    const { c, sent } = pushSetup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const [w1, w2] = [await worker(c, 'w1@exemplo.com', '11144477735'), await worker(c, 'w2@exemplo.com', '39053344705')];
    unwrap(await c.useCases.push.subscribe.execute({ accountId: await accountOf(c, { farmer_id: farmerId }), input: { endpoint: 'https://push.exemplo.com/produtor', keys: KEYS } }));
    unwrap(await c.useCases.push.subscribe.execute({ accountId: await accountOf(c, { worker_id: w1 }), input: { endpoint: 'https://push.exemplo.com/w1', keys: KEYS } }));
    unwrap(await c.useCases.push.subscribe.execute({ accountId: await accountOf(c, { worker_id: w2 }), input: { endpoint: 'https://push.exemplo.com/w2', keys: KEYS } }));

    const a1 = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w1 }));
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w2 }));
    await c.notifier.idle();
    assert.deepEqual(sent.map((s) => [s.endpoint, s.url]), [
      ['https://push.exemplo.com/produtor', `produtor/servicos/${serviceId}`],
      ['https://push.exemplo.com/produtor', `produtor/servicos/${serviceId}`]
    ]);

    sent.length = 0;
    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: a1.id, action: 'Accept' }));
    await c.notifier.idle();
    assert.deepEqual(sent.map((s) => [s.endpoint, s.title]), [
      ['https://push.exemplo.com/w1', 'Você foi aceito!'],
      ['https://push.exemplo.com/w2', 'Candidatura recusada']
    ]);
  });

  it('a mesma inscrição reenviada não duplica e passa para a conta que entrou por último', async () => {
    const { c, sent } = pushSetup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const farmerAccount = await accountOf(c, { farmer_id: farmerId });

    unwrap(await c.useCases.push.subscribe.execute({ accountId: farmerAccount, input: { endpoint: ENDPOINT, keys: KEYS } }));
    unwrap(await c.useCases.push.subscribe.execute({ accountId: farmerAccount, input: { endpoint: ENDPOINT, keys: KEYS } }));
    assert.equal((await c.repos.pushSubscriptions.find()).length, 1);

    unwrap(await c.useCases.push.subscribe.execute({ accountId: await accountOf(c, { worker_id: w }), input: { endpoint: ENDPOINT, keys: KEYS } }));
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    await c.notifier.idle();
    assert.equal(sent.length, 0); // o aparelho agora é do trabalhador, não do produtor
  });

  it('inscrição revogada no navegador é apagada no primeiro envio', async () => {
    const { c } = pushSetup([ENDPOINT]);
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    unwrap(await c.useCases.push.subscribe.execute({ accountId: await accountOf(c, { farmer_id: farmerId }), input: { endpoint: ENDPOINT, keys: KEYS } }));

    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    await c.notifier.idle();
    assert.equal((await c.repos.pushSubscriptions.find()).length, 0);
  });

  it('cancelar inscrição para os envios; conta inexistente dá not_found', async () => {
    const { c, sent } = pushSetup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const farmerAccount = await accountOf(c, { farmer_id: farmerId });
    unwrap(await c.useCases.push.subscribe.execute({ accountId: farmerAccount, input: { endpoint: ENDPOINT, keys: KEYS } }));
    unwrap(await c.useCases.push.unsubscribe.execute({ accountId: farmerAccount, endpoint: ENDPOINT }));

    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    await c.notifier.idle();
    assert.equal(sent.length, 0);

    const missing = await c.useCases.push.subscribe.execute({ accountId: 999, input: { endpoint: ENDPOINT, keys: KEYS } });
    assert.equal(missing.ok ? '' : missing.kind, 'not_found');
  });

  it('falha no serviço de push não afeta a operação', async () => {
    const c = createContainer({ clock: { now: () => NOW }, push: { send: () => Promise.reject(new Error('fora do ar')) } });
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    unwrap(await c.useCases.push.subscribe.execute({ accountId: await accountOf(c, { farmer_id: farmerId }), input: { endpoint: ENDPOINT, keys: KEYS } }));

    const original = console.error;
    console.error = () => {};
    try {
      unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
      await c.notifier.idle();
    } finally {
      console.error = original;
    }
  });
});

describe('Token de sessão', () => {
  it('confere a assinatura e a validade', () => {
    let now = NOW;
    const tokens = createHmacSessionTokens('segredo', { now: () => now }, 60_000);
    const token = tokens.issue({ kind: 'system', id: 7 });
    assert.deepEqual(tokens.verify(token), { kind: 'system', id: 7 });

    // Trocar o payload (ex.: virar outra conta) invalida a assinatura.
    const [, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ kind: 'system', id: 1, exp: Date.parse(NOW) + 60_000 })).toString('base64url')}.${signature ?? ''}`;
    assert.equal(tokens.verify(forged), null);
    assert.equal(createHmacSessionTokens('outro-segredo', { now: () => now }).verify(token), null);
    assert.equal(tokens.verify('lixo'), null);

    now = new Date(Date.parse(NOW) + 60_000).toISOString();
    assert.equal(tokens.verify(token), null);
  });
});

describe('SystemUserUseCases', () => {
  it('cadastra, entra e não repete e-mail', async () => {
    const c = setup();
    const tutor = unwrap(await c.useCases.systemUsers.create({ email: 'tutor@exemplo.com', name: 'Tiago', role: 'tutor', password: PASSWORD }));
    assert.equal('password_hash' in tutor, false);

    const login = unwrap(await c.useCases.systemUsers.login({ email: 'tutor@exemplo.com', password: PASSWORD }));
    assert.deepEqual([login.id, login.role], [tutor.id, 'tutor']);
    const wrong = await c.useCases.systemUsers.login({ email: 'tutor@exemplo.com', password: 'errada-123' });
    assert.equal(wrong.ok ? '' : wrong.kind, 'unauthorized');

    const again = await c.useCases.systemUsers.create({ email: 'tutor@exemplo.com', name: 'X', role: 'admin', password: PASSWORD });
    assert.equal(again.ok ? '' : again.kind, 'conflict');
  });

  it('edita o perfil; e-mail repetido dá conflito; o administrador não muda o próprio cargo', async () => {
    const c = setup();
    const admin = unwrap(await c.useCases.systemUsers.create({ email: 'admin@exemplo.com', name: 'Ana', role: 'admin', password: PASSWORD }));
    const tutor = unwrap(await c.useCases.systemUsers.create({ email: 'tutor@exemplo.com', name: 'Tiago', role: 'tutor', password: PASSWORD }));

    const own = unwrap(await c.useCases.systemUsers.updateOwn(tutor.id, { name: 'Tiago Souza', email: 'tiago@exemplo.com' }));
    assert.deepEqual([own.name, own.email, own.role], ['Tiago Souza', 'tiago@exemplo.com', 'tutor']);
    assert.ok((await c.useCases.systemUsers.login({ email: 'tiago@exemplo.com', password: PASSWORD })).ok);

    const taken = await c.useCases.systemUsers.updateOwn(tutor.id, { email: 'admin@exemplo.com' });
    assert.equal(taken.ok ? '' : taken.kind, 'conflict');

    const ownRole = await c.useCases.systemUsers.updateByAdmin(admin.id, admin.id, { role: 'tutor' });
    assert.equal(ownRole.ok ? '' : ownRole.kind, 'conflict');
    assert.equal(unwrap(await c.useCases.systemUsers.get(admin.id)).role, 'admin');

    const promoted = unwrap(await c.useCases.systemUsers.updateByAdmin(admin.id, tutor.id, { role: 'admin' }));
    assert.equal(promoted.role, 'admin');
  });

  it('o administrador inicial é criado uma vez só', async () => {
    const c = setup();
    const input = { email: 'admin@exemplo.com', password: PASSWORD, name: 'Admin' };
    assert.equal(await c.useCases.systemUsers.ensureInitialAdmin(input), 'created');
    assert.equal(await c.useCases.systemUsers.ensureInitialAdmin({ ...input, password: 'outra-senha-1' }), 'exists');
    assert.ok((await c.useCases.systemUsers.login(input)).ok); // a senha original continua valendo
  });
});

describe('AdminUseCases', () => {
  async function accountId(c: Container, filter: { farmer_id: number } | { worker_id: number }): Promise<number> {
    const [account] = await c.repos.accounts.find(filter);
    assert.ok(account);
    return account.id;
  }

  it('remover um perfil mantém a conta com o outro', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const id = await accountId(c, { farmer_id: farmerId });
    const session = unwrap(await c.useCases.accounts.addProfile(id, { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' }));

    unwrap(await c.useCases.workers.delete(session.profiles.worker ?? 0));
    const user = unwrap(await c.useCases.admin.getUser(id));
    assert.deepEqual([user.farmer?.id, user.worker], [farmerId, null]);
  });

  it('remover a conta leva os dois perfis e as inscrições de push', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const id = await accountId(c, { farmer_id: farmerId });
    unwrap(await c.useCases.accounts.addProfile(id, { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' }));
    unwrap(await c.useCases.push.subscribe.execute({ accountId: id, input: { endpoint: 'https://push.exemplo.com/ana', keys: { p256dh: 'p', auth: 'a' } } }));

    unwrap(await c.useCases.admin.deleteUser(id));
    assert.equal((await c.repos.accounts.find()).length, 0);
    assert.equal((await c.repos.farmers.find()).length, 0);
    assert.equal((await c.repos.workers.find()).length, 0);
    assert.equal((await c.repos.pushSubscriptions.find()).length, 0);
  });

  it('serviço em andamento bloqueia a remoção da conta sem apagar nada', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const id = await accountId(c, { farmer_id: farmerId });
    // A conta também é trabalhadora (perfil sem bloqueio): não pode sumir sozinha.
    unwrap(await c.useCases.accounts.addProfile(id, { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' }));
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const application = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: application.id, action: 'Accept' }));

    const blocked = await c.useCases.admin.deleteUser(id);
    assert.equal(blocked.ok ? '' : blocked.kind, 'conflict');
    const user = unwrap(await c.useCases.admin.getUser(id));
    assert.ok(user.farmer && user.worker);

    const workerAccount = await c.useCases.admin.deleteUser(await accountId(c, { worker_id: w }));
    assert.equal(workerAccount.ok ? '' : workerAccount.kind, 'conflict');
  });

  it('a lista mascara o CPF e o detalhe não', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const id = await accountId(c, { farmer_id: farmerId });
    const [listed] = await c.useCases.admin.listUsers();
    assert.equal(listed?.farmer?.cpf, '***.982.247-**');
    assert.equal(unwrap(await c.useCases.admin.getUser(id)).farmer?.cpf, '52998224725');
  });
});
