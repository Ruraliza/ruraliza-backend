import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type AccountsTestbed, accountsTestbed, givenAccount, givenFarmer, givenWorker } from '../testing/account-fixtures';
import { AddProfileUseCase } from './add-profile.usecase';

describe('AddProfileUseCase', () => {
  let t: AccountsTestbed;
  let addProfile: AddProfileUseCase;

  beforeEach(() => {
    t = accountsTestbed();
    addProfile = new AddProfileUseCase(t);
  });

  it('cria o perfil que falta com o e-mail da conta e já abre o painel dele', async () => {
    const farmer = await givenFarmer(t);
    const account = await givenAccount(t, { farmer_id: farmer.id });

    const session = unwrap(await addProfile.execute({
      accountId: account.id,
      input: { role: 'worker', name: 'Ana', phone: '2', cpf: '52998224725', experience: '3 anos' }
    }));

    assert.deepEqual(t.created, [{
      role: 'worker',
      data: { email: 'ana@exemplo.com', name: 'Ana', phone: '2', cpf: '52998224725', bio: null, certificates: null, courses: null, experience: '3 anos' }
    }]);
    assert.equal(session.role, 'worker');
    assert.deepEqual(session.profiles, { farmer: farmer.id, worker: session.id });
    assert.equal((await t.accounts.findById(account.id))?.last_role, 'worker');
  });

  it('a conta que já tem esse perfil dá conflict', async () => {
    const account = await givenAccount(t, { farmer_id: (await givenFarmer(t)).id });

    const result = await addProfile.execute({ accountId: account.id, input: { role: 'farmer', name: 'Ana', phone: '1', cpf: '52998224725' } });

    assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
    assert.deepEqual(t.created, []);
  });

  it('o CPF de outra conta dá conflict; o da própria conta vale', async () => {
    await givenWorker(t, 'bia@exemplo.com', '11144477735');
    const account = await givenAccount(t, { farmer_id: (await givenFarmer(t)).id });

    const taken = await addProfile.execute({ accountId: account.id, input: { role: 'worker', name: 'Ana', phone: '1', cpf: '11144477735' } });
    assert.equal(taken.ok ? 'ok' : taken.kind, 'conflict');
    unwrap(await addProfile.execute({ accountId: account.id, input: { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' } }));
  });

  it('conta inexistente dá not_found', async () => {
    const result = await addProfile.execute({ accountId: 99, input: { role: 'worker', name: 'Ana', phone: '1', cpf: '52998224725' } });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
