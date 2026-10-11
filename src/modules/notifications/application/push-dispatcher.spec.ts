import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { type PushTestbed, givenAccount, givenSubscription, pushTestbed } from '../testing/push-fixtures';
import { PushDispatcher } from './push-dispatcher';

const MESSAGE = { title: 'Nova candidatura', body: 'Maria se candidatou a Capina.', url: 'produtor/servicos/1' };

describe('PushDispatcher', () => {
  let t: PushTestbed;
  let dispatcher: PushDispatcher;

  beforeEach(() => {
    t = pushTestbed();
    dispatcher = new PushDispatcher(t);
  });

  it('envia a todos os aparelhos da conta do perfil avisado, e só a eles', async () => {
    const farmer = await givenAccount(t, { farmer_id: 1 });
    const worker = await givenAccount(t, { worker_id: 1 });
    await givenSubscription(t, farmer, 'https://push.exemplo.com/celular');
    await givenSubscription(t, farmer, 'https://push.exemplo.com/notebook');
    await givenSubscription(t, worker, 'https://push.exemplo.com/trabalhador');

    dispatcher.notify('farmer', 1, MESSAGE);
    await dispatcher.idle();

    assert.deepEqual(t.delivered.map((d) => d.endpoint).sort(), ['https://push.exemplo.com/celular', 'https://push.exemplo.com/notebook']);
    assert.deepEqual(t.delivered[0]?.message, MESSAGE);
  });

  it('inscrição revogada (gone) é apagada no primeiro envio', async () => {
    const farmer = await givenAccount(t, { farmer_id: 1 });
    await givenSubscription(t, farmer, 'https://push.exemplo.com/velho');
    await givenSubscription(t, farmer, 'https://push.exemplo.com/novo');
    t.gone.add('https://push.exemplo.com/velho');

    dispatcher.notify('farmer', 1, MESSAGE);
    await dispatcher.idle();

    assert.deepEqual((await t.pushSubscriptions.find()).map((s) => s.endpoint), ['https://push.exemplo.com/novo']);
  });

  it('perfil sem conta não envia nada, e falha do serviço de push não escapa', async () => {
    dispatcher.notify('worker', 99, MESSAGE);
    await dispatcher.idle();
    assert.deepEqual(t.delivered, []);

    const farmer = await givenAccount(t, { farmer_id: 1 });
    await givenSubscription(t, farmer, 'https://push.exemplo.com/a');
    const failing = new PushDispatcher({ ...t, sender: { send: () => Promise.reject(new Error('push fora do ar')) } });
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]): void => { errors.push(args); };
    try {
      failing.notify('farmer', 1, MESSAGE);
      await failing.idle();
    } finally {
      console.error = original;
    }
    assert.equal(errors.length, 1);
  });
});
