import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type AuthTestbed, authTestbed, givenAccount } from '../testing/auth-fixtures';
import { RequestPasswordResetUseCase } from './request-password-reset.usecase';
import { ResetPasswordUseCase } from './reset-password.usecase';

describe('esqueci a senha', () => {
  let t: AuthTestbed;

  beforeEach(() => {
    t = authTestbed();
  });

  it('o token vale uma vez, troca a senha, abre a sessão e guarda só o resumo', async () => {
    const account = await givenAccount(t);

    const { reset_token } = unwrap(await new RequestPasswordResetUseCase(t).execute({ email: 'ana@exemplo.com' }));
    const stored = await t.accounts.findById(account.id);
    assert.notEqual(stored?.reset_token_digest, reset_token);

    const session = unwrap(await new ResetPasswordUseCase(t).execute({ token: reset_token, password: 'senha-nova' }));
    assert.equal(session.account_id, account.id);
    const after = await t.accounts.findById(account.id);
    assert.deepEqual([after?.password_hash, after?.reset_token_digest, after?.reset_expires_at], ['hash(senha-nova)', null, null]);

    const again = await new ResetPasswordUseCase(t).execute({ token: reset_token, password: 'outra-senha' });
    assert.equal(again.ok ? 'ok' : again.kind, 'invalid');
  });

  it('o token expira em 30 minutos, e um pedido novo invalida o anterior', async () => {
    await givenAccount(t);
    const request = new RequestPasswordResetUseCase(t);
    const first = unwrap(await request.execute({ email: 'ana@exemplo.com' })).reset_token;
    const second = unwrap(await request.execute({ email: 'ana@exemplo.com' })).reset_token;

    const old = await new ResetPasswordUseCase(t).execute({ token: first, password: 'senha-nova' });
    assert.equal(old.ok ? 'ok' : old.kind, 'invalid');

    t.setNow('2026-01-01T12:30:00.000Z');
    const late = await new ResetPasswordUseCase(t).execute({ token: second, password: 'senha-nova' });
    assert.equal(late.ok ? 'ok' : late.kind, 'invalid');
  });

  it('e-mail sem conta dá not_found', async () => {
    const result = await new RequestPasswordResetUseCase(t).execute({ email: 'ninguem@exemplo.com' });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
