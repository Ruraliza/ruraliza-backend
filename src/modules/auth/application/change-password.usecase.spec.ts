import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type AuthTestbed, NOW, authTestbed, givenAccount } from '../testing/auth-fixtures';
import { ChangePasswordUseCase } from './change-password.usecase';

describe('ChangePasswordUseCase', () => {
  let t: AuthTestbed;
  let farmerId: number;

  beforeEach(async () => {
    t = authTestbed();
    farmerId = (await t.farmers.create({ email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', farms: [], photo_url: null, insertion_date: NOW })).id;
  });

  it('exige a senha atual e cancela uma redefinição pendente', async () => {
    const account = await givenAccount(t, { farmer_id: farmerId, reset_token_digest: 'pendente', reset_expires_at: NOW });

    unwrap(await new ChangePasswordUseCase(t).execute({ role: 'farmer', profileId: farmerId, input: { current_password: 'senha-atual', new_password: 'senha-nova' } }));

    const after = await t.accounts.findById(account.id);
    assert.deepEqual([after?.password_hash, after?.reset_token_digest], ['hash(senha-nova)', null]);
  });

  it('senha atual errada dá unauthorized; repetir a mesma dá invalid', async () => {
    await givenAccount(t, { farmer_id: farmerId });
    const change = new ChangePasswordUseCase(t);

    const wrong = await change.execute({ role: 'farmer', profileId: farmerId, input: { current_password: 'errada', new_password: 'senha-nova' } });
    assert.equal(wrong.ok ? 'ok' : wrong.kind, 'unauthorized');
    const same = await change.execute({ role: 'farmer', profileId: farmerId, input: { current_password: 'senha-atual', new_password: 'senha-atual' } });
    assert.equal(same.ok ? 'ok' : same.kind, 'invalid');
  });

  it('perfil inexistente dá not_found', async () => {
    const result = await new ChangePasswordUseCase(t).execute({ role: 'worker', profileId: 99, input: { current_password: 'a', new_password: 'b' } });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
