// Testes das regras de negócio direto nos casos de uso (sem HTTP), com repositórios em memória
// e relógio fixo injetados pelo container.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type Container, createContainer } from '../src/container';
import type { Result } from '../src/domain/result';
import { InMemoryRepository } from '../src/infra/memory/InMemoryRepository';

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
  const farmer = unwrap(await c.useCases.farmers.create({ email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', password: PASSWORD }));
  const farm = unwrap(await c.useCases.farms.create(farmer.id, { address: 'Sítio', city: 'Três Rios', state: 'RJ', latitude: -22.1165, longitude: -43.2092 }));
  return { farmerId: farmer.id, farmId: farm.id };
}

async function worker(c: Container, email: string, cpf: string): Promise<number> {
  const w = unwrap(await c.useCases.workers.create({ email, name: email, phone: '1', cpf, password: PASSWORD, bio: null, certificates: null, courses: null, experience: null }));
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

  it('editar o ponto no mapa troca latitude e longitude', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);

    const farm = unwrap(await c.useCases.farms.update(farmerId, farmId, { latitude: -22.2, longitude: -43.3 }));
    assert.deepEqual([farm.latitude, farm.longitude], [-22.2, -43.3]);
    assert.equal(farm.address, 'Sítio');
  });
});

describe('Localização da fazenda para o trabalhador', () => {
  it('só o trabalhador aceito no serviço recebe as coordenadas', async () => {
    const c = setup();
    const { farmerId, farmId } = await farmerWithFarm(c);
    const serviceId = await openService(c, farmerId, farmId);
    const accepted = await worker(c, 'a@exemplo.com', '11144477735');
    const other = await worker(c, 'b@exemplo.com', '52998224725');

    // Vaga aberta: ninguém vê o ponto.
    const [open] = await c.useCases.services.searchOpen();
    assert.equal(open?.farm.latitude, undefined);
    assert.equal(unwrap(await c.useCases.services.getOpen(serviceId, accepted)).farm.latitude, undefined);

    const app = unwrap(await c.useCases.hiring.apply(serviceId, accepted));
    unwrap(await c.useCases.hiring.apply(serviceId, other));
    unwrap(await c.useCases.hiring.analyze(serviceId, { application_id: app.id, action: 'Accept' }));

    const seen = unwrap(await c.useCases.services.getOpen(serviceId, accepted)).farm;
    assert.deepEqual([seen.latitude, seen.longitude], [-22.1165, -43.2092]);
    assert.equal(unwrap(await c.useCases.services.getOpen(serviceId)).farm.latitude, undefined);
    assert.equal(unwrap(await c.useCases.services.getOpen(serviceId, other)).farm.latitude, undefined);

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
    const app = unwrap(await c.useCases.hiring.apply(serviceId, w));
    unwrap(await c.useCases.hiring.analyze(serviceId, { application_id: app.id, action: 'Accept' }));

    assert.equal('latitude' in unwrap(await c.useCases.services.getOpen(serviceId, w)).farm, false);
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
    unwrap(await c.useCases.farmers.create({ email: 'a@exemplo.com', name: 'A', phone: '1', cpf: '52998224725', password: PASSWORD }));

    const sameEmail = await c.useCases.farmers.create({ email: 'a@exemplo.com', name: 'B', phone: '1', cpf: '11144477735', password: PASSWORD });
    const sameCpf = await c.useCases.farmers.create({ email: 'b@exemplo.com', name: 'B', phone: '1', cpf: '52998224725', password: PASSWORD });
    assert.equal(sameEmail.ok ? '' : sameEmail.message, 'Já existe um cadastro com este e-mail.');
    assert.equal(sameCpf.ok ? '' : sameCpf.message, 'Já existe um cadastro com este CPF.');

    // Outro tipo de perfil pode repetir o CPF.
    unwrap(await c.useCases.workers.create({ email: 'a@exemplo.com', name: 'A', phone: '1', cpf: '52998224725', password: PASSWORD, bio: null, certificates: null, courses: null, experience: null }));
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
    const [credential] = await c.repos.credentials.find({ role: 'farmer', user_id: farmerId });
    assert.ok(credential && !credential.password_hash.includes(PASSWORD));

    assert.deepEqual(unwrap(await c.useCases.auth.login({ role: 'farmer', email: 'ana@exemplo.com', password: PASSWORD })), { role: 'farmer', id: farmerId });
    const wrong = await c.useCases.auth.login({ role: 'farmer', email: 'ana@exemplo.com', password: 'outra-senha' });
    const unknown = await c.useCases.auth.login({ role: 'farmer', email: 'ninguem@exemplo.com', password: PASSWORD });
    const otherRole = await c.useCases.auth.login({ role: 'worker', email: 'ana@exemplo.com', password: PASSWORD });
    for (const r of [wrong, unknown, otherRole]) assert.equal(r.ok ? '' : r.message, 'E-mail ou senha incorretos.');
  });

  it('mesmo e-mail com perfil de produtor e de trabalhador: cada um tem a sua senha', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const w = unwrap(await c.useCases.workers.create({ email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', password: 'senha-de-trabalho', bio: null, certificates: null, courses: null, experience: null }));

    assert.deepEqual(unwrap(await c.useCases.auth.login({ role: 'farmer', email: 'ana@exemplo.com', password: PASSWORD })), { role: 'farmer', id: farmerId });
    assert.deepEqual(unwrap(await c.useCases.auth.login({ role: 'worker', email: 'ana@exemplo.com', password: 'senha-de-trabalho' })), { role: 'worker', id: w.id });
    assert.equal((await c.useCases.auth.login({ role: 'worker', email: 'ana@exemplo.com', password: PASSWORD })).ok, false);
  });

  it('esqueci a senha: o token vale uma vez, troca a senha e o anterior deixa de valer', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');

    const missing = await c.useCases.auth.requestReset({ role: 'worker', email: 'ninguem@exemplo.com' });
    assert.equal(missing.ok ? '' : missing.kind, 'not_found');

    const first = unwrap(await c.useCases.auth.requestReset({ role: 'worker', email: 'w@exemplo.com' })).reset_token;
    const second = unwrap(await c.useCases.auth.requestReset({ role: 'worker', email: 'w@exemplo.com' })).reset_token;
    const stale = await c.useCases.auth.resetPassword({ token: first, password: 'nova-senha-1' });
    assert.equal(stale.ok ? '' : stale.kind, 'invalid'); // o pedido novo invalida o anterior

    assert.deepEqual(unwrap(await c.useCases.auth.resetPassword({ token: second, password: 'nova-senha-1' })), { role: 'worker', id: w });
    const reused = await c.useCases.auth.resetPassword({ token: second, password: 'outra-senha-2' });
    assert.equal(reused.ok ? '' : reused.kind, 'invalid');

    assert.equal((await c.useCases.auth.login({ role: 'worker', email: 'w@exemplo.com', password: PASSWORD })).ok, false);
    unwrap(await c.useCases.auth.login({ role: 'worker', email: 'w@exemplo.com', password: 'nova-senha-1' }));
  });

  it('o token de redefinição expira em 30 minutos', async () => {
    const { c, setNow } = setupAt();
    await worker(c, 'w@exemplo.com', '11144477735');
    const { reset_token } = unwrap(await c.useCases.auth.requestReset({ role: 'worker', email: 'w@exemplo.com' }));

    setNow('2026-01-01T00:30:00.000Z');
    const late = await c.useCases.auth.resetPassword({ token: reset_token, password: 'nova-senha-1' });
    assert.equal(late.ok ? '' : late.kind, 'invalid');
  });

  it('trocar a senha logado exige a senha atual e cancela a redefinição pendente', async () => {
    const c = setup();
    const { farmerId } = await farmerWithFarm(c);
    const { reset_token } = unwrap(await c.useCases.auth.requestReset({ role: 'farmer', email: 'ana@exemplo.com' }));

    const wrong = await c.useCases.auth.changePassword('farmer', farmerId, { current_password: 'errada-123', new_password: 'nova-senha-1' });
    assert.equal(wrong.ok ? '' : wrong.kind, 'unauthorized');
    const same = await c.useCases.auth.changePassword('farmer', farmerId, { current_password: PASSWORD, new_password: PASSWORD });
    assert.equal(same.ok ? '' : same.kind, 'invalid');
    const ghost = await c.useCases.auth.changePassword('worker', 999, { current_password: PASSWORD, new_password: 'nova-senha-1' });
    assert.equal(ghost.ok ? '' : ghost.kind, 'not_found');

    unwrap(await c.useCases.auth.changePassword('farmer', farmerId, { current_password: PASSWORD, new_password: 'nova-senha-1' }));
    unwrap(await c.useCases.auth.login({ role: 'farmer', email: 'ana@exemplo.com', password: 'nova-senha-1' }));
    const pending = await c.useCases.auth.resetPassword({ token: reset_token, password: 'outra-senha-2' });
    assert.equal(pending.ok ? '' : pending.kind, 'invalid');
  });

  it('remover o perfil remove a senha', async () => {
    const c = setup();
    const w = await worker(c, 'w@exemplo.com', '11144477735');
    unwrap(await c.useCases.workers.delete(w));
    assert.deepEqual(await c.repos.credentials.find({ role: 'worker', user_id: w }), []);
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
    unwrap(await c.useCases.hiring.apply(serviceId, w));

    const [application] = unwrap(await c.useCases.services.listApplications(serviceId));
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
