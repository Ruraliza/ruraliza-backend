import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { SIGNUP, type WorkersTestbed, workersTestbed } from '../testing/worker-fixtures';
import { CreateWorkerProfileUseCase } from './create-worker-profile.usecase';
import { RegisterWorkerUseCase } from './register-worker.usecase';

describe('RegisterWorkerUseCase', () => {
  let t: WorkersTestbed;
  let register: RegisterWorkerUseCase;

  beforeEach(() => {
    t = workersTestbed();
    register = new RegisterWorkerUseCase({ ...t, createProfile: new CreateWorkerProfileUseCase(t) });
  });

  it('cria o perfil (com os textos) e a conta, e devolve a sessão no painel de trabalhador', async () => {
    const { worker, user } = unwrap(await register.execute(SIGNUP));

    assert.deepEqual([worker.bio, worker.experience, worker.photo_url, worker.resume_url], ['Colheita de café', '5 anos', null, null]);
    assert.equal('password' in worker, false);
    assert.deepEqual([user.role, user.id, user.profiles], ['worker', worker.id, { farmer: null, worker: worker.id }]);
    assert.equal((await t.accounts.find())[0]?.password_hash, 'hash(senha-forte)');
  });

  it('CPF já usado por um produtor dá conflict', async () => {
    await t.farmers.create({ email: 'joao@exemplo.com', name: 'João', phone: '1', cpf: SIGNUP.cpf, farms: [], photo_url: null, insertion_date: '2026-01-01T00:00:00.000Z' });

    const result = await register.execute(SIGNUP);

    assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
    assert.deepEqual(await t.workers.find(), []);
  });
});
