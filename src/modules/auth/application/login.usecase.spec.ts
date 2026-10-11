import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { authTestbed, givenAccount } from '../testing/auth-fixtures';
import { LoginUseCase } from './login.usecase';

describe('LoginUseCase', () => {
  it('confere a senha e abre o último painel usado', async () => {
    const t = authTestbed();
    const account = await givenAccount(t, { farmer_id: 1, worker_id: 2, last_role: 'worker' });

    const session = unwrap(await new LoginUseCase(t).execute({ email: 'ana@exemplo.com', password: 'senha-atual' }));

    assert.deepEqual(session, { account_id: account.id, role: 'worker', id: 2, profiles: { farmer: 1, worker: 2 } });
  });

  it('senha errada e e-mail desconhecido têm a mesma resposta', async () => {
    const t = authTestbed();
    await givenAccount(t);
    const login = new LoginUseCase(t);

    const results = [await login.execute({ email: 'ana@exemplo.com', password: 'errada' }), await login.execute({ email: 'x@exemplo.com', password: 'senha-atual' })];

    assert.deepEqual(results.map((r) => (r.ok ? 'ok' : `${r.kind}: ${r.message}`)), Array(2).fill('unauthorized: E-mail ou senha incorretos.'));
  });
});
