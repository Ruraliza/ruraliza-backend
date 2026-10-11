// Contratação de ponta a ponta pelos casos de uso: candidatura, aceite, desistência, pagamento,
// validade das vagas e o que o trabalhador vê da fazenda.
// Testes de integração: os módulos juntos pelo container, sem HTTP (as regras de cada caso de uso
// estão nos specs ao lado do código, em src/modules/*/application).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type Container, createContainer } from '../../src/container';
import { NOW, farmerWithFarm, openService, setup, unwrap, worker } from './support';

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

    const [assigned] = unwrap(await c.useCases.workers.listWorkerServices.execute({ workerId: accepted }));
    assert.equal(assigned?.farm.longitude, -43.2092);
    const applications = unwrap(await c.useCases.workers.listWorkerApplications.execute({ workerId: other }));
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
    assert.deepEqual(unwrap(await c.useCases.farmers.getFarmer.execute({ farmerId: farmerId })).farms, []);
    const service = unwrap(await c.useCases.services.getService.execute({ serviceId: serviceId }));
    assert.equal(service.farm.deleted_at, NOW);
  });
});
