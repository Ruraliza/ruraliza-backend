import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type AccountsTestbed, NOW, accountsTestbed, givenAccount, givenFarmer, givenWorker } from '../testing/account-fixtures';
import { changeAccountEmail, checkNewAccount, createAccount, unlinkProfile } from './account-profiles';

describe('conta nos cadastros e remoções de perfil', () => {
  let t: AccountsTestbed;

  beforeEach(() => {
    t = accountsTestbed();
  });

  it('cadastro novo: e-mail com conta ou CPF em qualquer perfil dá conflict', async () => {
    await givenAccount(t, { email: 'ana@exemplo.com' });
    await givenWorker(t, 'bia@exemplo.com', '11144477735');

    const email = await checkNewAccount(t, 'ana@exemplo.com', '39053344705');
    assert.equal(email.ok ? 'ok' : email.kind, 'conflict');
    const cpf = await checkNewAccount(t, 'nova@exemplo.com', '11144477735');
    assert.equal(cpf.ok ? 'ok' : cpf.kind, 'conflict');
    unwrap(await checkNewAccount(t, 'nova@exemplo.com', '39053344705'));
  });

  it('a conta guarda só o hash da senha e começa no painel do primeiro perfil', async () => {
    const hasher = { hash: (p: string) => Promise.resolve(`hash(${p})`), verify: () => Promise.resolve(true) };

    const account = await createAccount(t.accounts, hasher, { email: 'ana@exemplo.com', password: 'senha-forte', role: 'worker', profileId: 3 });

    assert.deepEqual(account, {
      id: account.id, email: 'ana@exemplo.com', password_hash: 'hash(senha-forte)', reset_token_digest: null, reset_expires_at: null,
      farmer_id: null, worker_id: 3, last_role: 'worker'
    });
  });

  it('trocar o e-mail num perfil vale para a conta e para o outro perfil; e-mail de outra conta dá conflict', async () => {
    const farmer = await givenFarmer(t);
    const worker = await givenWorker(t);
    await givenAccount(t, { farmer_id: farmer.id, worker_id: worker.id });
    await givenAccount(t, { email: 'bia@exemplo.com' });

    unwrap(await changeAccountEmail(t, 'farmer', farmer.id, 'ana.nova@exemplo.com'));
    assert.equal((await t.accounts.find({ farmer_id: farmer.id }))[0]?.email, 'ana.nova@exemplo.com');
    assert.equal((await t.workers.findById(worker.id))?.email, 'ana.nova@exemplo.com');

    const taken = await changeAccountEmail(t, 'worker', worker.id, 'bia@exemplo.com');
    assert.equal(taken.ok ? 'ok' : taken.kind, 'conflict');
  });

  it('tirar um perfil mantém a conta no outro; tirar o último apaga a conta e as inscrições de push', async () => {
    const account = await givenAccount(t, { farmer_id: 1, worker_id: 2, last_role: 'farmer' });
    await t.pushSubscriptions.create({ account_id: account.id, endpoint: 'https://push.exemplo.com/a', p256dh: 'p', auth: 'a', insertion_date: NOW });

    await unlinkProfile(t, 'farmer', 1);
    const left = await t.accounts.findById(account.id);
    assert.deepEqual([left?.farmer_id, left?.worker_id, left?.last_role], [null, 2, 'worker']);
    assert.equal((await t.pushSubscriptions.find()).length, 1);

    await unlinkProfile(t, 'worker', 2);
    assert.equal(await t.accounts.findById(account.id), undefined);
    assert.deepEqual(await t.pushSubscriptions.find(), []);
  });
});
