import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { FARMER_ID, type HiringTestbed, NOW, givenApplication, givenService, givenWorker, hiringTestbed } from '../testing/hiring-fixtures';
import { ApplyForServiceUseCase } from './apply-for-service.usecase';

describe('ApplyForServiceUseCase', () => {
  let t: HiringTestbed;
  let apply: ApplyForServiceUseCase;

  beforeEach(() => {
    t = hiringTestbed();
    apply = new ApplyForServiceUseCase(t);
  });

  it('cria a candidatura Pending, avisa as telas e manda push ao produtor', async () => {
    const service = await givenService(t);
    const worker = await givenWorker(t);

    const application = unwrap(await apply.execute({ serviceId: service.id, workerId: worker.id }));

    assert.deepEqual(application, { id: application.id, service_id: service.id, worker_id: worker.id, status: 'Pending', insertion_date: NOW });
    assert.deepEqual(t.published, [[`service:${service.id}:applications`, `worker:${worker.id}:applications`]]);
    assert.deepEqual(t.pushes, [{
      role: 'farmer', profileId: FARMER_ID,
      message: { title: 'Nova candidatura', body: 'Maria se candidatou a Capina.', url: `produtor/servicos/${service.id}` }
    }]);
  });

  it('não repete candidatura; recusada não pode se candidatar de novo', async () => {
    const service = await givenService(t);
    const maria = await givenWorker(t);
    const joao = await givenWorker(t, 'Joao');
    await givenApplication(t, service, maria);
    await givenApplication(t, service, joao, 'Rejected');

    const again = await apply.execute({ serviceId: service.id, workerId: maria.id });
    assert.equal(again.ok ? 'ok' : again.kind, 'conflict');
    const rejected = await apply.execute({ serviceId: service.id, workerId: joao.id });
    assert.equal(rejected.ok ? 'ok' : rejected.message, 'Sua candidatura a este serviço foi recusada e você não pode se candidatar novamente.');
  });

  it('vaga fechada ou vencida não recebe candidatura', async () => {
    const worker = await givenWorker(t);
    const taken = await givenService(t, { status: 'In Progress' });
    const expired = await givenService(t, { expires_at: '2026-09-29' });

    for (const service of [taken, expired]) {
      const result = await apply.execute({ serviceId: service.id, workerId: worker.id });
      assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
    }
    assert.deepEqual(await t.applications.find(), []);
  });

  it('o perfil de trabalhador não concorre ao serviço publicado pelo perfil de produtor da mesma conta', async () => {
    const service = await givenService(t);
    const worker = await givenWorker(t);
    await t.accounts.create({
      email: worker.email, password_hash: 'x', reset_token_digest: null, reset_expires_at: null,
      farmer_id: FARMER_ID, worker_id: worker.id, last_role: 'worker'
    });

    const result = await apply.execute({ serviceId: service.id, workerId: worker.id });

    assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
  });

  it('serviço ou trabalhador inexistente dá not_found', async () => {
    const service = await givenService(t);
    const worker = await givenWorker(t);

    for (const input of [{ serviceId: 99, workerId: worker.id }, { serviceId: service.id, workerId: 99 }]) {
      const result = await apply.execute(input);
      assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
    }
  });
});
