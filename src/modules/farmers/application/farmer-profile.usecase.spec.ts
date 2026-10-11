import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type FarmersTestbed, farmersTestbed, givenFarmer } from '../testing/farmer-fixtures';
import { GetFarmerUseCase } from './get-farmer.usecase';
import { ListFarmersUseCase } from './list-farmers.usecase';
import { UpdateFarmerUseCase } from './update-farmer.usecase';

describe('ListFarmersUseCase / GetFarmerUseCase / UpdateFarmerUseCase', () => {
  let t: FarmersTestbed;

  beforeEach(() => {
    t = farmersTestbed();
  });

  it('a lista mascara o CPF; o perfil vem completo', async () => {
    const farmer = await givenFarmer(t);

    assert.deepEqual((await new ListFarmersUseCase(t).execute()).map((f) => f.cpf), ['***.982.247-**']);
    assert.equal(unwrap(await new GetFarmerUseCase(t).execute({ farmerId: farmer.id })).cpf, '52998224725');
    const missing = await new GetFarmerUseCase(t).execute({ farmerId: 99 });
    assert.equal(missing.ok ? 'ok' : missing.kind, 'not_found');
  });

  it('editar troca só o que veio; o e-mail novo vale para a conta e para o outro perfil', async () => {
    const farmer = await givenFarmer(t);
    const worker = await t.workers.create({
      email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', bio: null, certificates: null, courses: null, experience: null,
      photo_url: null, resume_url: null, insertion_date: farmer.insertion_date
    });
    await t.accounts.create({ email: 'ana@exemplo.com', password_hash: 'h', reset_token_digest: null, reset_expires_at: null, farmer_id: farmer.id, worker_id: worker.id, last_role: 'farmer' });

    const updated = unwrap(await new UpdateFarmerUseCase(t).execute({ farmerId: farmer.id, changes: { name: 'Ana Maria', email: 'nova@exemplo.com' } }));

    assert.deepEqual([updated.name, updated.email, updated.phone], ['Ana Maria', 'nova@exemplo.com', '1']);
    assert.equal((await t.accounts.find())[0]?.email, 'nova@exemplo.com');
    assert.equal((await t.workers.findById(worker.id))?.email, 'nova@exemplo.com');
  });

  it('e-mail de outra conta dá conflict; produtor inexistente dá not_found', async () => {
    const farmer = await givenFarmer(t);
    await t.accounts.create({ email: 'ana@exemplo.com', password_hash: 'h', reset_token_digest: null, reset_expires_at: null, farmer_id: farmer.id, worker_id: null, last_role: 'farmer' });
    await t.accounts.create({ email: 'bia@exemplo.com', password_hash: 'h', reset_token_digest: null, reset_expires_at: null, farmer_id: null, worker_id: 9, last_role: 'worker' });

    const taken = await new UpdateFarmerUseCase(t).execute({ farmerId: farmer.id, changes: { email: 'bia@exemplo.com' } });
    assert.equal(taken.ok ? 'ok' : taken.kind, 'conflict');
    assert.equal((await t.farmers.findById(farmer.id))?.email, 'ana@exemplo.com');
    const missing = await new UpdateFarmerUseCase(t).execute({ farmerId: 99, changes: { name: 'X' } });
    assert.equal(missing.ok ? 'ok' : missing.kind, 'not_found');
  });
});
