import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { DEFAULT_PREFERENCES } from '../domain/preferences';
import { type AccountsTestbed, accountsTestbed, givenAccount } from '../testing/account-fixtures';
import { GetPreferencesUseCase } from './get-preferences.usecase';
import { UpdatePreferencesUseCase } from './update-preferences.usecase';

describe('GetPreferencesUseCase / UpdatePreferencesUseCase', () => {
  let t: AccountsTestbed;

  beforeEach(() => {
    t = accountsTestbed();
  });

  it('conta que nunca mudou nada tem os padrões (tema claro, texto normal, sem alto contraste)', async () => {
    const account = await givenAccount(t, { farmer_id: 1 });

    assert.deepEqual(unwrap(await new GetPreferencesUseCase(t).execute({ accountId: account.id })), DEFAULT_PREFERENCES);
  });

  it('muda só o que veio e guarda na conta', async () => {
    const account = await givenAccount(t, { farmer_id: 1 });
    const update = new UpdatePreferencesUseCase(t);

    await update.execute({ accountId: account.id, changes: { theme: 'dark' } });
    const saved = unwrap(await update.execute({ accountId: account.id, changes: { text_size: 'large', high_contrast: true } }));

    assert.deepEqual(saved, { theme: 'dark', text_size: 'large', high_contrast: true, whatsapp_alerts: false });
    assert.deepEqual((await t.accounts.findById(account.id))?.preferences, saved);
  });

  it('conta inexistente dá not_found', async () => {
    const read = await new GetPreferencesUseCase(t).execute({ accountId: 99 });
    const write = await new UpdatePreferencesUseCase(t).execute({ accountId: 99, changes: { theme: 'dark' } });

    assert.deepEqual([read.ok ? 'ok' : read.kind, write.ok ? 'ok' : write.kind], ['not_found', 'not_found']);
  });
});
