import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import type { SystemUsersModuleDeps } from '../system-users.module';
import { NOW, givenSystemUser, systemUsersTestbed } from '../testing/system-user-fixtures';
import { CreateSystemUserUseCase } from './create-system-user.usecase';
import { EnsureInitialAdminUseCase } from './ensure-initial-admin.usecase';
import { GetSystemUserUseCase } from './get-system-user.usecase';
import { ListSystemUsersUseCase } from './list-system-users.usecase';
import { SystemLoginUseCase } from './system-login.usecase';

describe('equipe: cadastro, login e leitura', () => {
  let t: SystemUsersModuleDeps;

  beforeEach(() => {
    t = systemUsersTestbed();
  });

  it('cadastra guardando só o hash; nenhuma leitura devolve o hash', async () => {
    const user = unwrap(await new CreateSystemUserUseCase(t).execute({ email: 'tiago@exemplo.com', name: 'Tiago', role: 'tutor', password: 'senha-forte' }));

    assert.deepEqual(user, { id: user.id, email: 'tiago@exemplo.com', name: 'Tiago', role: 'tutor', insertion_date: NOW });
    assert.equal((await t.systemUsers.findById(user.id))?.password_hash, 'hash(senha-forte)');
    assert.equal('password_hash' in unwrap(await new GetSystemUserUseCase(t).execute({ systemUserId: user.id })), false);
    assert.equal('password_hash' in ((await new ListSystemUsersUseCase(t).execute())[0] ?? {}), false);
  });

  it('e-mail repetido dá conflict', async () => {
    await givenSystemUser(t, 'tiago@exemplo.com');

    const result = await new CreateSystemUserUseCase(t).execute({ email: 'tiago@exemplo.com', name: 'X', role: 'admin', password: 'senha-forte' });

    assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
  });

  it('login confere a senha; e-mail desconhecido e senha errada têm a mesma resposta', async () => {
    await givenSystemUser(t, 'tiago@exemplo.com');
    const login = new SystemLoginUseCase(t);

    assert.equal(unwrap(await login.execute({ email: 'tiago@exemplo.com', password: 'senha-forte' })).email, 'tiago@exemplo.com');
    const wrong = await login.execute({ email: 'tiago@exemplo.com', password: 'errada' });
    const unknown = await login.execute({ email: 'ninguem@exemplo.com', password: 'senha-forte' });
    assert.deepEqual([wrong, unknown].map((r) => (r.ok ? 'ok' : `${r.kind}: ${r.message}`)), Array(2).fill('unauthorized: E-mail ou senha incorretos.'));
  });

  it('o administrador inicial é criado uma vez só', async () => {
    const ensure = new EnsureInitialAdminUseCase({ createSystemUser: new CreateSystemUserUseCase(t) });
    const input = { email: 'admin@exemplo.com', name: 'Ana', password: 'senha-forte' };

    assert.equal(await ensure.execute(input), 'created');
    assert.equal(await ensure.execute({ ...input, password: 'outra-senha' }), 'exists');
    assert.equal((await t.systemUsers.find())[0]?.role, 'admin');
  });
});
