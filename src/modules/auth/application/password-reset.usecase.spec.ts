import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type AuthTestbed, authTestbed, givenAccount } from '../testing/auth-fixtures';
import { RequestPasswordResetUseCase } from './request-password-reset.usecase';
import { ResetPasswordUseCase } from './reset-password.usecase';

describe('esqueci a senha', () => {
  let t: AuthTestbed;

  // O código que iria por e-mail (o testbed guarda cada entrega).
  const lastCode = (): string => t.sentResetCodes.at(-1)?.code ?? assert.fail('nenhum código entregue');

  beforeEach(() => {
    t = authTestbed();
  });

  it('o código vai só para a entrega (o e-mail), vale uma vez, troca a senha e guarda só o resumo', async () => {
    const account = await givenAccount(t);

    await new RequestPasswordResetUseCase(t).execute({ email: 'ana@exemplo.com' });
    const reset_token = lastCode();
    assert.equal(t.sentResetCodes.at(-1)?.email, 'ana@exemplo.com');
    const stored = await t.accounts.findById(account.id);
    assert.notEqual(stored?.reset_token_digest, reset_token);

    const session = unwrap(await new ResetPasswordUseCase(t).execute({ token: reset_token, password: 'senha-nova' }));
    assert.equal(session.account_id, account.id);
    const after = await t.accounts.findById(account.id);
    assert.deepEqual([after?.password_hash, after?.reset_token_digest, after?.reset_expires_at], ['hash(senha-nova)', null, null]);

    const again = await new ResetPasswordUseCase(t).execute({ token: reset_token, password: 'outra-senha' });
    assert.equal(again.ok ? 'ok' : again.kind, 'invalid');
  });

  it('o código expira em 30 minutos, e um pedido novo invalida o anterior', async () => {
    await givenAccount(t);
    const request = new RequestPasswordResetUseCase(t);
    await request.execute({ email: 'ana@exemplo.com' });
    const first = lastCode();
    await request.execute({ email: 'ana@exemplo.com' });
    const second = lastCode();

    const old = await new ResetPasswordUseCase(t).execute({ token: first, password: 'senha-nova' });
    assert.equal(old.ok ? 'ok' : old.kind, 'invalid');

    t.setNow('2026-01-01T12:30:00.000Z');
    const late = await new ResetPasswordUseCase(t).execute({ token: second, password: 'senha-nova' });
    assert.equal(late.ok ? 'ok' : late.kind, 'invalid');
  });

  // O caso de uso não devolve nada nos dois casos (Promise<void>): só a entrega muda.
  it('e-mail sem conta não entrega nada e não dá erro (não revela quem tem cadastro)', async () => {
    await givenAccount(t);

    await new RequestPasswordResetUseCase(t).execute({ email: 'ninguem@exemplo.com' });
    await new RequestPasswordResetUseCase(t).execute({ email: 'ana@exemplo.com' });

    assert.deepEqual(t.sentResetCodes.map((s) => s.email), ['ana@exemplo.com']);
  });

  it('sem entrega (o padrão até o e-mail existir), a redefinição fica desligada: nenhum código é criado', async () => {
    const account = await givenAccount(t);

    await new RequestPasswordResetUseCase({ ...t, deliverResetCode: null }).execute({ email: 'ana@exemplo.com' });

    assert.equal((await t.accounts.findById(account.id))?.reset_token_digest, null);
    assert.deepEqual(t.sentResetCodes, []);
  });
});
