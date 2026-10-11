import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
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

  it('registra o pagamento do valor do serviço, conclui o serviço e avisa o trabalhador', async () => {
    const maria = await givenWorker(t);
    const service = await givenService(t, { status: 'In Progress', worker_id: maria.id, price: 900 });

    const { service: paid, payment } = unwrap(await pay.execute({ serviceId: service.id }));

    assert.deepEqual(payment, {
      id: payment.id, service_id: service.id, farmer_id: FARMER_ID, worker_id: maria.id, value: 900, status: 'Completed', insertion_date: NOW
    });
    assert.deepEqual([paid.status, paid.payment_id], ['Completed', payment.id]);
    assert.deepEqual(await t.services.findById(service.id), paid);
    assert.deepEqual(t.pushes.map((p) => [p.profileId, p.message.title]), [[maria.id, 'Pagamento liberado']]);
  });

  for (const status of ['Pending', 'Completed', 'Cancelled'] as const) {
    it(`serviço ${status} não pode ser pago`, async () => {
      const service = await givenService(t, { status });

      const result = await pay.execute({ serviceId: service.id });

      assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
      assert.deepEqual(await t.payments.find(), []);
    });
  }

  it('serviço inexistente dá not_found', async () => {
    const result = await pay.execute({ serviceId: 99 });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
