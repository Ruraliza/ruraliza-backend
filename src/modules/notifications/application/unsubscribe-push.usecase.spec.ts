import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type PushTestbed, givenAccount, givenSubscription, pushTestbed } from '../testing/push-fixtures';
import { UnsubscribePushUseCase } from './unsubscribe-push.usecase';

describe('UnsubscribePushUseCase', () => {
  let t: PushTestbed;
  let unsubscribe: UnsubscribePushUseCase;

  beforeEach(() => {
    t = pushTestbed();
    unsubscribe = new UnsubscribePushUseCase(t);
  });

  it('remove só a inscrição daquele aparelho, e repetir não é erro', async () => {
    const account = await givenAccount(t, { farmer_id: 1 });
    await givenSubscription(t, account, 'https://push.exemplo.com/celular');
    await givenSubscription(t, account, 'https://push.exemplo.com/notebook');

    unwrap(await unsubscribe.execute({ accountId: account.id, endpoint: 'https://push.exemplo.com/celular' }));
    unwrap(await unsubscribe.execute({ accountId: account.id, endpoint: 'https://push.exemplo.com/celular' }));

    assert.deepEqual((await t.pushSubscriptions.find()).map((s) => s.endpoint), ['https://push.exemplo.com/notebook']);
  });

  it('não remove a inscrição de outra conta', async () => {
    const ana = await givenAccount(t, { farmer_id: 1 });
    const bia = await givenAccount(t, { worker_id: 1 });
    await givenSubscription(t, ana, 'https://push.exemplo.com/a');

    unwrap(await unsubscribe.execute({ accountId: bia.id, endpoint: 'https://push.exemplo.com/a' }));

    assert.equal((await t.pushSubscriptions.find()).length, 1);
  });

  it('conta inexistente dá not_found', async () => {
    const result = await unsubscribe.execute({ accountId: 99, endpoint: 'https://push.exemplo.com/a' });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
