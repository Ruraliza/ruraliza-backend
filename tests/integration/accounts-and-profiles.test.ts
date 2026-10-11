// A conta única com dois perfis: cadastro, segundo perfil, e-mail, senha, remoções em cascata e a administração.
// Testes de integração: os módulos juntos pelo container, sem HTTP (as regras de cada caso de uso
// estão nos specs ao lado do código, em src/modules/*/application).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type Container, createContainer } from '../../src/container';
import { NOW, PASSWORD, farmerWithFarm, openService, setup, unwrap, worker } from './support';

describe('FarmerUseCases', () => {
  it('não remove produtor com serviço em andamento; depois do pagamento remove em cascata', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const app = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: app.id, action: 'Accept' }));

    const blocked = await c.useCases.farmers.deleteFarmer.execute({ farmerId: farmerId });
    assert.equal(blocked.ok ? 'ok' : blocked.kind, 'conflict');

    unwrap(await c.useCases.hiring.payService.execute({ serviceId: serviceId }));
    unwrap(await c.useCases.farmers.deleteFarmer.execute({ farmerId: farmerId }));

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
    const accountId = unwrap(await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: PASSWORD })).account_id;
    const session = unwrap(await c.useCases.accounts.addProfile.execute({ accountId: accountId, input: { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' } }));

    const own = await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: session.id });
    assert.equal(own.ok ? '' : own.message, 'Você não pode se candidatar a um serviço que você mesmo publicou.');
    unwrap(await c.useCases.hiring.applyForService.execute({ serviceId, workerId: await worker(c, 'outro@exemplo.com', '11144477735') }));
  });
});
describe('Contas', () => {
  const workerProfile = { name: 'Ana', phone: '1', cpf: '52998224725', bio: null, certificates: null, courses: null, experience: null };

  it('um e-mail e um CPF abrem uma conta só, em qualquer tipo de perfil', async () => {
    const c = setup();
    unwrap(await c.useCases.farmers.registerFarmer.execute({ email: 'a@exemplo.com', name: 'A', phone: '1', cpf: '52998224725', password: PASSWORD }));

    const sameEmail = await c.useCases.workers.registerWorker.execute({ ...workerProfile, email: 'a@exemplo.com', cpf: '11144477735', password: PASSWORD });
    const sameCpf = await c.useCases.farmers.registerFarmer.execute({ email: 'b@exemplo.com', name: 'B', phone: '1', cpf: '52998224725', password: PASSWORD });
    const sameCpfOtherRole = await c.useCases.workers.registerWorker.execute({ ...workerProfile, email: 'b@exemplo.com', password: PASSWORD });
    for (const r of [sameEmail, sameCpf, sameCpfOtherRole]) assert.equal(r.ok ? '' : r.kind, 'conflict');
    assert.equal(sameEmail.ok ? '' : sameEmail.message, 'Já existe uma conta com este e-mail. Entre com ela e ative o outro perfil pelo menu.');
  });

  it('o segundo perfil entra na mesma conta, com a mesma senha, e o login abre o último painel', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const first = unwrap(await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: PASSWORD }));
    assert.deepEqual(first, { account_id: first.account_id, role: 'farmer', id: farmerId, profiles: { farmer: farmerId, worker: null } });

    const both = unwrap(await c.useCases.accounts.addProfile.execute({ accountId: first.account_id, input: { role: 'worker', ...workerProfile, experience: '3 anos' } }));
    assert.equal(both.role, 'worker');
    assert.deepEqual(both.profiles, { farmer: farmerId, worker: both.id });
    const created = await c.repos.workers.findById(both.id);
    assert.deepEqual([created?.email, created?.experience], ['ana@exemplo.com', '3 anos']);

    const again = await c.useCases.accounts.addProfile.execute({ accountId: first.account_id, input: { role: 'worker', ...workerProfile } });
    assert.equal(again.ok ? '' : again.kind, 'conflict');

    // A mesma senha abre o último painel usado; trocar de painel muda o próximo login.
    assert.equal(unwrap(await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: PASSWORD })).role, 'worker');
    assert.equal(unwrap(await c.useCases.accounts.setActiveRole.execute({ accountId: first.account_id, role: 'farmer' })).id, farmerId);
    assert.equal(unwrap(await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: PASSWORD })).role, 'farmer');
  });

  it('o segundo perfil não pode usar o CPF de outra conta', async () => {
    const c = setup();
    await farmerWithFarm(c);
    await worker(c, 'w@exemplo.com', '11144477735');
    const accountId = unwrap(await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: PASSWORD })).account_id;

    const taken = await c.useCases.accounts.addProfile.execute({ accountId: accountId, input: { role: 'worker', ...workerProfile, cpf: '11144477735' } });
    assert.equal(taken.ok ? '' : taken.kind, 'conflict');
  });

  it('só troca para um painel que a conta tem', async () => {
    const c = setup();
    await farmerWithFarm(c);
    const accountId = unwrap(await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: PASSWORD })).account_id;

    const missing = await c.useCases.accounts.setActiveRole.execute({ accountId: accountId, role: 'worker' });
    assert.equal(missing.ok ? '' : missing.kind, 'not_found');
    const ghost = await c.useCases.accounts.setActiveRole.execute({ accountId: 999, role: 'farmer' });
    assert.equal(ghost.ok ? '' : ghost.kind, 'not_found');
  });

  it('trocar o e-mail num perfil vale para a conta e para o outro perfil', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const accountId = unwrap(await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: PASSWORD })).account_id;
    const workerId = unwrap(await c.useCases.accounts.addProfile.execute({ accountId: accountId, input: { role: 'worker', ...workerProfile } })).id;
    await worker(c, 'w@exemplo.com', '11144477735');

    const taken = await c.useCases.farmers.updateFarmer.execute({ farmerId: farmerId, changes: { email: 'w@exemplo.com' } });
    assert.equal(taken.ok ? '' : taken.kind, 'conflict');

    unwrap(await c.useCases.farmers.updateFarmer.execute({ farmerId: farmerId, changes: { email: 'nova@exemplo.com' } }));
    assert.equal((await c.repos.workers.findById(workerId))?.email, 'nova@exemplo.com');
    unwrap(await c.useCases.auth.login.execute({ email: 'nova@exemplo.com', password: PASSWORD }));
  });

  it('remover um perfil mantém a conta com o outro; remover os dois apaga a conta', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const accountId = unwrap(await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: PASSWORD })).account_id;
    const workerId = unwrap(await c.useCases.accounts.addProfile.execute({ accountId: accountId, input: { role: 'worker', ...workerProfile } })).id;

    unwrap(await c.useCases.workers.deleteWorker.execute({ workerId: workerId }));
    assert.deepEqual(unwrap(await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: PASSWORD })).profiles, { farmer: farmerId, worker: null });

    unwrap(await c.useCases.farmers.deleteFarmer.execute({ farmerId: farmerId }));
    assert.deepEqual(await c.repos.accounts.find(), []);
    assert.equal((await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: PASSWORD })).ok, false);
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

    assert.equal(unwrap(await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: PASSWORD })).id, farmerId);
    const wrong = await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: 'outra-senha' });
    const unknown = await c.useCases.auth.login.execute({ email: 'ninguem@exemplo.com', password: PASSWORD });
    for (const r of [wrong, unknown]) assert.equal(r.ok ? '' : r.message, 'E-mail ou senha incorretos.');
  });

  it('esqueci a senha: o token vale uma vez, troca a senha e o anterior deixa de valer', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');

    const missing = await c.useCases.auth.requestPasswordReset.execute({ email: 'ninguem@exemplo.com' });
    assert.equal(missing.ok ? '' : missing.kind, 'not_found');

    const first = unwrap(await c.useCases.auth.requestPasswordReset.execute({ email: 'w@exemplo.com' })).reset_token;
    const second = unwrap(await c.useCases.auth.requestPasswordReset.execute({ email: 'w@exemplo.com' })).reset_token;
    const stale = await c.useCases.auth.resetPassword.execute({ token: first, password: 'nova-senha-1' });
    assert.equal(stale.ok ? '' : stale.kind, 'invalid'); // o pedido novo invalida o anterior

    const reset = unwrap(await c.useCases.auth.resetPassword.execute({ token: second, password: 'nova-senha-1' }));
    assert.deepEqual([reset.role, reset.id], ['worker', w]);
    const reused = await c.useCases.auth.resetPassword.execute({ token: second, password: 'outra-senha-2' });
    assert.equal(reused.ok ? '' : reused.kind, 'invalid');

    assert.equal((await c.useCases.auth.login.execute({ email: 'w@exemplo.com', password: PASSWORD })).ok, false);
    unwrap(await c.useCases.auth.login.execute({ email: 'w@exemplo.com', password: 'nova-senha-1' }));
  });

  it('o token de redefinição expira em 30 minutos', async () => {
    const { c, setNow } = setupAt();
    await worker(c, 'w@exemplo.com', '11144477735');
    const { reset_token } = unwrap(await c.useCases.auth.requestPasswordReset.execute({ email: 'w@exemplo.com' }));

    setNow('2026-01-01T00:30:00.000Z');
    const late = await c.useCases.auth.resetPassword.execute({ token: reset_token, password: 'nova-senha-1' });
    assert.equal(late.ok ? '' : late.kind, 'invalid');
  });

  it('trocar a senha logado exige a senha atual, cancela a redefinição pendente e vale para os dois perfis', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const { reset_token } = unwrap(await c.useCases.auth.requestPasswordReset.execute({ email: 'ana@exemplo.com' }));
    const accountId = unwrap(await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: PASSWORD })).account_id;
    const workerId = unwrap(await c.useCases.accounts.addProfile.execute({ accountId: accountId, input: { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' } })).id;

    const wrong = await c.useCases.auth.changePassword.execute({ role: 'farmer', profileId: farmerId, input: { current_password: 'errada-123', new_password: 'nova-senha-1' } });
    assert.equal(wrong.ok ? '' : wrong.kind, 'unauthorized');
    const same = await c.useCases.auth.changePassword.execute({ role: 'farmer', profileId: farmerId, input: { current_password: PASSWORD, new_password: PASSWORD } });
    assert.equal(same.ok ? '' : same.kind, 'invalid');
    const ghost = await c.useCases.auth.changePassword.execute({ role: 'worker', profileId: 999, input: { current_password: PASSWORD, new_password: 'nova-senha-1' } });
    assert.equal(ghost.ok ? '' : ghost.kind, 'not_found');

    unwrap(await c.useCases.auth.changePassword.execute({ role: 'farmer', profileId: farmerId, input: { current_password: PASSWORD, new_password: 'nova-senha-1' } }));
    unwrap(await c.useCases.auth.login.execute({ email: 'ana@exemplo.com', password: 'nova-senha-1' }));
    // A senha é da conta: a troca feita pelo perfil de produtor vale no de trabalhador.
    unwrap(await c.useCases.auth.changePassword.execute({ role: 'worker', profileId: workerId, input: { current_password: 'nova-senha-1', new_password: 'nova-senha-2' } }));
    const pending = await c.useCases.auth.resetPassword.execute({ token: reset_token, password: 'outra-senha-2' });
    assert.equal(pending.ok ? '' : pending.kind, 'invalid');
  });

  it('remover o único perfil remove a conta', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    unwrap(await c.useCases.workers.deleteWorker.execute({ workerId: w }));
    assert.deepEqual(await c.repos.accounts.find({ worker_id: w }), []);
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
    const session = unwrap(await c.useCases.accounts.addProfile.execute({ accountId: id, input: { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' } }));

    unwrap(await c.useCases.workers.deleteWorker.execute({ workerId: session.profiles.worker ?? 0 }));
    const user = unwrap(await c.useCases.admin.getAccountDetail.execute({ accountId: id }));
    assert.deepEqual([user.farmer?.id, user.worker], [farmerId, null]);
  });

  it('remover a conta leva os dois perfis e as inscrições de push', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const id = await accountId(c, { farmer_id: farmerId });
    unwrap(await c.useCases.accounts.addProfile.execute({ accountId: id, input: { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' } }));
    unwrap(await c.useCases.push.subscribe.execute({ accountId: id, input: { endpoint: 'https://push.exemplo.com/ana', keys: { p256dh: 'p', auth: 'a' } } }));

    unwrap(await c.useCases.admin.deleteAccount.execute({ accountId: id }));
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
    unwrap(await c.useCases.accounts.addProfile.execute({ accountId: id, input: { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' } }));
    const serviceId = await openService(c, farmerId, farmId);
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    const application = unwrap(await c.useCases.hiring.applyForService.execute({ serviceId: serviceId, workerId: w }));
    unwrap(await c.useCases.hiring.analyzeApplication.execute({ serviceId: serviceId, application_id: application.id, action: 'Accept' }));

    const blocked = await c.useCases.admin.deleteAccount.execute({ accountId: id });
    assert.equal(blocked.ok ? '' : blocked.kind, 'conflict');
    const user = unwrap(await c.useCases.admin.getAccountDetail.execute({ accountId: id }));
    assert.ok(user.farmer && user.worker);

    const workerAccount = await c.useCases.admin.deleteAccount.execute({ accountId: await accountId(c, { worker_id: w }) });
    assert.equal(workerAccount.ok ? '' : workerAccount.kind, 'conflict');
  });

  it('a lista mascara o CPF e o detalhe não', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const id = await accountId(c, { farmer_id: farmerId });
    const [listed] = await c.useCases.admin.listAccounts.execute();
    assert.equal(listed?.farmer?.cpf, '***.982.247-**');
    assert.equal(unwrap(await c.useCases.admin.getAccountDetail.execute({ accountId: id })).farmer?.cpf, '52998224725');
  });
});
