import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type HiringTestbed, givenApplication, givenService, givenWorker, hiringTestbed } from '../testing/hiring-fixtures';
import { ListServiceApplicationsUseCase } from './list-service-applications.usecase';

describe('ListServiceApplicationsUseCase', () => {
  let t: HiringTestbed;
  let list: ListServiceApplicationsUseCase;

  beforeEach(() => {
    t = hiringTestbed();
    list = new ListServiceApplicationsUseCase(t);
  });

  it('traz as candidaturas com o trabalhador (CPF, telefone e e-mail mascarados) e a reputação dele', async () => {
    const service = await givenService(t);
    const maria = { ...(await givenWorker(t)), phone: '24988887766' };
    await t.workers.update(maria);
    const application = await givenApplication(t, service, maria);
    await givenApplication(t, await givenService(t), maria);

    const items = unwrap(await list.execute({ serviceId: service.id }));

    assert.deepEqual(items, [{
      ...application,
      worker: { ...maria, cpf: '***.444.777-**', phone: '(24) *****-**66', email: 'm***@exemplo.com' },
      reputation: { average: null, count: 0, score: 3.5, punctuality: null, effort: null, quality: null }
    }]);
  });

  it('serviço inexistente dá not_found', async () => {
    const result = await list.execute({ serviceId: 99 });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
