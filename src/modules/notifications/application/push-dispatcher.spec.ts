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

  it('guarda o aviso na central de notificações mesmo sem nenhum aparelho inscrito', async () => {
    await givenAccount(t, { farmer_id: 1 });

    dispatcher.notify('farmer', 1, MESSAGE);
    await dispatcher.idle();

    assert.deepEqual((await t.notifications.find({ role: 'farmer', profile_id: 1 })).map((n) => [n.title, n.read]), [['Nova candidatura', false]]);
    assert.deepEqual(t.delivered, []);
  });

  it('manda o WhatsApp só para quem ligou o aviso e tem celular, com o link da tela', async () => {
    const ACCEPTED = { title: 'Você foi aceito!', body: 'Capina', url: 'trabalhador/candidaturas', whatsapp: 'Ruraliza: você foi aceito em Capina.' };
    const optedIn = await givenAccount(t, { worker_id: 1 });
    await t.accounts.update({ ...optedIn, preferences: { theme: 'light', text_size: 'normal', high_contrast: false, whatsapp_alerts: true } });
    await givenAccount(t, { worker_id: 2 }); // não ligou
    const landline = await givenAccount(t, { worker_id: 3 });
    await t.accounts.update({ ...landline, preferences: { theme: 'light', text_size: 'normal', high_contrast: false, whatsapp_alerts: true } });
    t.phones.set('worker:1', '24999998888');
    t.phones.set('worker:2', '24988887777');
    t.phones.set('worker:3', '2433334444'); // fixo: não tem WhatsApp

    for (const id of [1, 2, 3]) dispatcher.notify('worker', id, ACCEPTED);
    dispatcher.notify('worker', 1, MESSAGE); // aviso sem texto de WhatsApp
    await dispatcher.idle();

    assert.equal(t.whatsapps.length, 1);
    const [sent] = t.whatsapps;
    assert.ok(sent);
    assert.equal(sent.phone, '5524999998888');
    assert.match(sent.text, /^Ruraliza: você foi aceito em Capina\.\n.+\/trabalhador\/candidaturas$/);
  });

  it('WhatsApp fora do ar não impede o push nem o histórico', async () => {
    const account = await givenAccount(t, { worker_id: 1 });
    await t.accounts.update({ ...account, preferences: { theme: 'light', text_size: 'normal', high_contrast: false, whatsapp_alerts: true } });
    await givenSubscription(t, account, 'https://push.exemplo.com/w1');
    t.phones.set('worker:1', '24999998888');
    const failing = new PushDispatcher({ ...t, whatsapp: { enabled: true, send: () => Promise.reject(new Error('WhatsApp fora do ar')) } });
    const original = console.error;
    console.error = (): void => undefined;
    try {
      failing.notify('worker', 1, { ...MESSAGE, whatsapp: 'oi' });
      await failing.idle();
    } finally {
      console.error = original;
    }

    assert.deepEqual(t.delivered.map((d) => d.endpoint), ['https://push.exemplo.com/w1']);
    assert.equal((await t.notifications.find({ role: 'worker', profile_id: 1 })).length, 1);
  });
});
