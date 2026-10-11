import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type AccountsTestbed, accountsTestbed, givenAccount } from '../testing/account-fixtures';
import { GetAccountUseCase } from './get-account.usecase';
import { SetActiveRoleUseCase } from './set-active-role.usecase';

describe('GetAccountUseCase / SetActiveRoleUseCase', () => {
  let t: AccountsTestbed;

  beforeEach(() => {
    t = accountsTestbed();
  });

  it('lê a sessão e troca o painel aberto', async () => {
    const account = await givenAccount(t, { farmer_id: 1, worker_id: 2, last_role: 'farmer' });

    assert.equal(unwrap(await new GetAccountUseCase(t).execute({ accountId: account.id })).role, 'farmer');
    const session = unwrap(await new SetActiveRoleUseCase(t).execute({ accountId: account.id, role: 'worker' }));

    assert.deepEqual([session.role, session.id], ['worker', 2]);
    assert.equal((await t.accounts.findById(account.id))?.last_role, 'worker');
  });

  it('painel que a conta não tem, ou conta inexistente, dá not_found', async () => {
    const account = await givenAccount(t, { farmer_id: 1 });

    const missing = await new SetActiveRoleUseCase(t).execute({ accountId: account.id, role: 'worker' });
    assert.equal(missing.ok ? 'ok' : missing.kind, 'not_found');
    const ghost = await new GetAccountUseCase(t).execute({ accountId: 99 });
    assert.equal(ghost.ok ? 'ok' : ghost.kind, 'not_found');
  });
});
