import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { directTransaction } from '#shared/domain/transaction';
import { unwrap } from '#shared/testing/unwrap';
import { FARMER_ID, type HiringTestbed, NOW, givenService, givenWorker, hiringTestbed } from '../testing/hiring-fixtures';
import { PayServiceUseCase } from './pay-service.usecase';

describe('PayServiceUseCase', () => {
  let t: HiringTestbed;
  let pay: PayServiceUseCase;

  beforeEach(() => {
    t = hiringTestbed();
    pay = new PayServiceUseCase(t);
  });

  it('registra o pagamento do total informado, conclui o serviço e avisa o trabalhador com o valor', async () => {
    const maria = await givenWorker(t);
    const service = await givenService(t, { status: 'In Progress', worker_id: maria.id });

    const { service: paid, payment } = unwrap(await pay.execute({ serviceId: service.id, value: 1250 }));

    assert.deepEqual(payment, {
      id: payment.id, service_id: service.id, farmer_id: FARMER_ID, worker_id: maria.id, value: 1250, status: 'Completed', insertion_date: NOW
    });
    assert.deepEqual([paid.status, paid.payment_id, paid.completed_at], ['Completed', payment.id, NOW]);
    assert.deepEqual(await t.services.findById(service.id), paid);
    assert.equal(t.pushes.length, 1);
    assert.match(t.pushes[0]?.message.body ?? '', /^Pagamento de R\$\s?1\.250,00 liberado em Capina\. Conte como foi na fazenda\.$/);
    assert.deepEqual([t.pushes[0]?.profileId, t.pushes[0]?.message.title], [maria.id, 'Pagamento liberado']);
  });

  it('pagar duas vezes dá conflict', async () => {
    const service = await givenService(t, { status: 'In Progress', worker_id: (await givenWorker(t)).id });
    unwrap(await pay.execute({ serviceId: service.id, value: 100 }));

    const again = await pay.execute({ serviceId: service.id, value: 100 });

    assert.equal(again.ok ? 'ok' : again.kind, 'conflict');
    assert.equal((await t.payments.find()).length, 1);
  });

  for (const status of ['Pending', 'Completed', 'Cancelled'] as const) {
    it(`serviço ${status} não pode ser pago`, async () => {
      const service = await givenService(t, { status });

      const result = await pay.execute({ serviceId: service.id, value: 100 });

      assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
      assert.deepEqual(await t.payments.find(), []);
    });
  }

  it('falha no meio não conclui o serviço', async () => {
    const service = await givenService(t, { status: 'In Progress', worker_id: (await givenWorker(t)).id });
    const failing = {
      ...t,
      services: {
        findById: (id: number) => t.services.findById(id), find: () => t.services.find(), create: t.services.create.bind(t.services),
        delete: (id: number) => t.services.delete(id), update: () => Promise.reject(new Error('queda do banco'))
      }
    };
    // Transação de verdade não está em memória: o que conta é o serviço continuar em andamento.
    const flaky = new PayServiceUseCase({ ...failing, transaction: directTransaction(failing) });

    await assert.rejects(flaky.execute({ serviceId: service.id, value: 100 }), /queda do banco/);
    assert.equal((await t.services.findById(service.id))?.status, 'In Progress');
    assert.deepEqual(t.pushes, []);
  });

  it('serviço inexistente dá not_found', async () => {
    const result = await pay.execute({ serviceId: 99, value: 100 });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
