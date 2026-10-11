import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type FarmersTestbed, NOW, SIGNUP, farmersTestbed } from '../testing/farmer-fixtures';
import { CreateFarmerProfileUseCase } from './create-farmer-profile.usecase';
import { RegisterFarmerUseCase } from './register-farmer.usecase';

describe('RegisterFarmerUseCase', () => {
  let t: FarmersTestbed;
  let register: RegisterFarmerUseCase;

  beforeEach(() => {
    t = farmersTestbed();
    register = new RegisterFarmerUseCase({ ...t, createProfile: new CreateFarmerProfileUseCase(t) });
  });

  it('cria o perfil e a conta (só com o hash da senha) e devolve a sessão no painel de produtor', async () => {
    const { farmer, user } = unwrap(await register.execute(SIGNUP));

    assert.deepEqual(farmer, { id: farmer.id, email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', farms: [], photo_url: null, insertion_date: NOW });
    assert.equal('password' in farmer, false);
    const [account] = await t.accounts.find({ farmer_id: farmer.id });
    assert.ok(account);
    assert.equal(account.password_hash, 'hash(senha-forte)');
    assert.deepEqual(user, { account_id: account.id, role: 'farmer', id: farmer.id, profiles: { farmer: farmer.id, worker: null } });
  });

  it('e-mail que já tem conta, ou CPF de qualquer perfil, dá conflict sem criar nada', async () => {
    unwrap(await register.execute(SIGNUP));

    const email = await register.execute({ ...SIGNUP, cpf: '39053344705' });
    assert.equal(email.ok ? 'ok' : email.kind, 'conflict');
    const cpf = await register.execute({ ...SIGNUP, email: 'outra@exemplo.com' });
    assert.equal(cpf.ok ? 'ok' : cpf.kind, 'conflict');
    assert.equal((await t.farmers.find()).length, 1);
    assert.equal((await t.accounts.find()).length, 1);
  });
});
