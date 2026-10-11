import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { KEYS, NOW, type PushTestbed, givenAccount, pushTestbed } from '../testing/push-fixtures';
import { SubscribePushUseCase } from './subscribe-push.usecase';

const ENDPOINT = 'https://push.exemplo.com/aparelho';

describe('SubscribePushUseCase', () => {
  let t: PushTestbed;
  let subscribe: SubscribePushUseCase;

  beforeEach(() => {
    t = pushTestbed();
    subscribe = new SubscribePushUseCase(t);
  });

  it('guarda a inscrição do aparelho na conta', async () => {
    const account = await givenAccount(t, { farmer_id: 1 });

    unwrap(await subscribe.execute({ accountId: account.id, input: { endpoint: ENDPOINT, keys: KEYS } }));

    const [sub] = await t.pushSubscriptions.find();
    assert.deepEqual(sub, { id: sub?.id, account_id: account.id, endpoint: ENDPOINT, p256dh: 'p', auth: 'a', insertion_date: NOW });
  });

  it('reenviar não duplica, e o aparelho passa para a conta que entrou por último', async () => {
    const ana = await givenAccount(t, { farmer_id: 1 });
    const bia = await givenAccount(t, { worker_id: 1 });

    unwrap(await subscribe.execute({ accountId: ana.id, input: { endpoint: ENDPOINT, keys: KEYS } }));
    unwrap(await subscribe.execute({ accountId: ana.id, input: { endpoint: ENDPOINT, keys: KEYS } }));
    unwrap(await subscribe.execute({ accountId: bia.id, input: { endpoint: ENDPOINT, keys: { p256dh: 'p2', auth: 'a2' } } }));

    const subs = await t.pushSubscriptions.find();
    assert.deepEqual(subs.map((s) => [s.account_id, s.p256dh]), [[bia.id, 'p2']]);
  });

  it('conta inexistente dá not_found', async () => {
    const result = await subscribe.execute({ accountId: 99, input: { endpoint: ENDPOINT, keys: KEYS } });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
