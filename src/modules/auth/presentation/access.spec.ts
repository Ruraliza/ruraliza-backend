import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { SessionTokens } from '#shared/domain/tokens';
import type { AccessRequest } from '#shared/infra/http/access';
import { type AuthTestbed, NOW, authTestbed, givenAccount, sessionTokens } from '../testing/auth-fixtures';
import { type AccessPolicies, createAccess } from './access';

const request = (token: string | null, parts: Partial<AccessRequest> = {}): AccessRequest => ({
  headers: token === null ? {} : { authorization: `Bearer ${token}` }, params: {}, body: {}, query: {}, ...parts
});

describe('políticas de acesso', () => {
  let t: AuthTestbed;
  let tokens: SessionTokens;
  let access: AccessPolicies;

  beforeEach(() => {
    t = authTestbed();
    tokens = sessionTokens();
    access = createAccess({ repos: t, tokens });
  });

  const outcome = async (p: Promise<{ ok: boolean; kind?: string; value?: unknown }>): Promise<string> => {
    const r = await p;
    return r.ok ? 'ok' : (r as { kind: string }).kind;
  };

  it('sem token é 401; token inválido é 401', async () => {
    assert.equal(await outcome(access.ownFarmer().authorize(request(null, { params: { id: '1' } }))), 'unauthorized');
    assert.equal(await outcome(access.ownFarmer().authorize(request('lixo', { params: { id: '1' } }))), 'unauthorized');
  });

  it('o próprio produtor passa; outro produtor é 403', async () => {
    const account = await givenAccount(t, { farmer_id: 1 });
    const token = tokens.issue({ kind: 'account', id: account.id });

    assert.equal(await outcome(access.ownFarmer().authorize(request(token, { params: { id: '1' } }))), 'ok');
    assert.equal(await outcome(access.ownFarmer().authorize(request(token, { params: { id: '2' } }))), 'forbidden');
    assert.equal(await outcome(access.ownWorker().authorize(request(token, { params: { id: '1' } }))), 'forbidden');
  });

  it('dono do serviço: só o produtor que publicou', async () => {
    const account = await givenAccount(t, { farmer_id: 1 });
    const token = tokens.issue({ kind: 'account', id: account.id });
    const service = (farmer_id: number): Promise<{ id: number }> => t.services.create({
      farmer_id, farm_id: 1, payment_id: null, worker_id: null, name: 'Capina', description: null,
      category: 'Manutenção', duration: 4, price: 200, expires_at: null, status: 'Pending', insertion_date: NOW
    });
    const own = await service(1);
    const other = await service(2);

    assert.equal(await outcome(access.farmerOfService().authorize(request(token, { params: { id: String(own.id) } }))), 'ok');
    assert.equal(await outcome(access.farmerOfService().authorize(request(token, { params: { id: String(other.id) } }))), 'forbidden');
  });

  it('conta removida perde o acesso na hora', async () => {
    const account = await givenAccount(t, { farmer_id: 1 });
    const token = tokens.issue({ kind: 'account', id: account.id });
    await t.accounts.delete(account.id);

    assert.equal(await outcome(access.ownFarmer().authorize(request(token, { params: { id: '1' } }))), 'unauthorized');
  });

  it('rotas da equipe: conta do app é 403; cargo sem a permissão é 403', async () => {
    const account = await givenAccount(t);
    const tutor = await t.systemUsers.create({ email: 't@exemplo.com', name: 'T', role: 'tutor', password_hash: 'h', insertion_date: NOW });
    const admin = await t.systemUsers.create({ email: 'a@exemplo.com', name: 'A', role: 'admin', password_hash: 'h', insertion_date: NOW });
    const manageUsers = access.system('users:manage');

    assert.equal(await outcome(manageUsers.authorize(request(tokens.issue({ kind: 'account', id: account.id })))), 'forbidden');
    assert.equal(await outcome(manageUsers.authorize(request(tokens.issue({ kind: 'system', id: tutor.id })))), 'forbidden');
    assert.equal(await outcome(manageUsers.authorize(request(tokens.issue({ kind: 'system', id: admin.id })))), 'ok');
  });
});
