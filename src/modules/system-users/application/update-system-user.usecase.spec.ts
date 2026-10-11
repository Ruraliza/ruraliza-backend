import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import type { SystemUsersModuleDeps } from '../system-users.module';
import { givenSystemUser, systemUsersTestbed } from '../testing/system-user-fixtures';
import { UpdateOwnSystemUserUseCase, UpdateSystemUserByAdminUseCase } from './update-system-user.usecase';

describe('equipe: edição', () => {
  let t: SystemUsersModuleDeps;

  beforeEach(() => {
    t = systemUsersTestbed();
  });

  it('o próprio usuário edita nome e e-mail; e-mail de outro dá conflict', async () => {
    await givenSystemUser(t, 'admin@exemplo.com', 'admin');
    const tutor = await givenSystemUser(t, 'tutor@exemplo.com');
    const updateOwn = new UpdateOwnSystemUserUseCase(t);

    const own = unwrap(await updateOwn.execute({ systemUserId: tutor.id, changes: { name: 'Tiago', email: 'tiago@exemplo.com' } }));
    assert.deepEqual([own.name, own.email, own.role], ['Tiago', 'tiago@exemplo.com', 'tutor']);
    const taken = await updateOwn.execute({ systemUserId: tutor.id, changes: { email: 'admin@exemplo.com' } });
    assert.equal(taken.ok ? 'ok' : taken.kind, 'conflict');
  });

  it('o administrador muda o cargo de outro, mas não o próprio', async () => {
    const admin = await givenSystemUser(t, 'admin@exemplo.com', 'admin');
    const tutor = await givenSystemUser(t, 'tutor@exemplo.com');
    const byAdmin = new UpdateSystemUserByAdminUseCase(t);

    const ownRole = await byAdmin.execute({ actorId: admin.id, systemUserId: admin.id, changes: { role: 'tutor' } });
    assert.equal(ownRole.ok ? 'ok' : ownRole.kind, 'conflict');
    assert.equal((await t.systemUsers.findById(admin.id))?.role, 'admin');

    assert.equal(unwrap(await byAdmin.execute({ actorId: admin.id, systemUserId: tutor.id, changes: { role: 'admin' } })).role, 'admin');
  });

  it('usuário inexistente dá not_found', async () => {
    const result = await new UpdateOwnSystemUserUseCase(t).execute({ systemUserId: 99, changes: { name: 'X' } });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
