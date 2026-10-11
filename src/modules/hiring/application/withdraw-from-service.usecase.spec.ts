import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { FARMER_ID, type HiringTestbed, givenApplication, givenService, givenWorker, hiringTestbed, statusesOf } from '../testing/hiring-fixtures';
import { WithdrawFromServiceUseCase } from './withdraw-from-service.usecase';

describe('WithdrawFromServiceUseCase', () => {
  let t: HiringTestbed;
  let withdraw: WithdrawFromServiceUseCase;

  beforeEach(() => {
    t = hiringTestbed();
    withdraw = new WithdrawFromServiceUseCase(t);
  });

  it('candidatura pendente é removida e o produtor é avisado', async () => {
    const service = await givenService(t);
    const maria = await givenWorker(t);
    await givenApplication(t, service, maria);

    const outcome = unwrap(await withdraw.execute({ serviceId: service.id, workerId: maria.id }));

    assert.equal(outcome.undone, 'application');
    assert.deepEqual(await t.applications.find(), []);
    assert.deepEqual(t.pushes.map((p) => [p.role, p.profileId, p.message.title]), [['farmer', FARMER_ID, 'Desistência']]);
  });

  it('depois do aceite, o serviço reabre e só as recusadas pelo aceite voltam a Pending', async () => {
    const [maria, joao, ana] = [await givenWorker(t), await givenWorker(t, 'Joao'), await givenWorker(t, 'Ana')];
    const service = await givenService(t, { status: 'In Progress', worker_id: maria.id });
    await givenApplication(t, service, maria, 'Accepted');
    await givenApplication(t, service, joao, 'Rejected', { auto_rejected: true });
    await givenApplication(t, service, ana, 'Rejected');

    const outcome = unwrap(await withdraw.execute({ serviceId: service.id, workerId: maria.id }));

    assert.equal(outcome.undone, 'service');
    assert.deepEqual([outcome.service.status, outcome.service.worker_id], ['Pending', null]);
    assert.deepEqual(await statusesOf(t, service), [[joao.id, 'Pending', undefined], [ana.id, 'Rejected', undefined]]);
    assert.deepEqual(t.published, [[`service:${service.id}:applications`, `worker:${maria.id}:applications`, `worker:${joao.id}:applications`]]);
  });

  it('candidatura recusada ou serviço encerrado não permite desistir', async () => {
    const maria = await givenWorker(t);
    const open = await givenService(t);
    await givenApplication(t, open, maria, 'Rejected');
    const done = await givenService(t, { status: 'Completed', worker_id: maria.id });
    await givenApplication(t, done, maria, 'Accepted');

    for (const service of [open, done]) {
      const result = await withdraw.execute({ serviceId: service.id, workerId: maria.id });
      assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
    }
  });

  it('sem candidatura no serviço, ou serviço inexistente, dá not_found', async () => {
    const service = await givenService(t);
    const maria = await givenWorker(t);

    const none = await withdraw.execute({ serviceId: service.id, workerId: maria.id });
    assert.equal(none.ok ? 'ok' : none.kind, 'not_found');
    const missing = await withdraw.execute({ serviceId: 99, workerId: maria.id });
    assert.equal(missing.ok ? 'ok' : missing.kind, 'not_found');
  });
});
