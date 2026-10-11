import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Account } from './account';
import { hasProfile, otherRole, profileKey, toSession } from './account.rules';

const account = (changes: Partial<Account>): Account => ({
  id: 7, email: 'a@exemplo.com', password_hash: 'h', reset_token_digest: null, reset_expires_at: null,
  farmer_id: null, worker_id: null, last_role: 'farmer', ...changes
});

describe('regras da conta', () => {
  it('a sessão abre o último painel usado', () => {
    assert.deepEqual(toSession(account({ farmer_id: 1, worker_id: 2, last_role: 'worker' })), {
      account_id: 7, role: 'worker', id: 2, profiles: { farmer: 1, worker: 2 }
    });
  });

  it('se o último painel não existe mais, abre o único perfil que sobrou', () => {
    assert.deepEqual(toSession(account({ worker_id: 2, last_role: 'farmer' })), {
      account_id: 7, role: 'worker', id: 2, profiles: { farmer: null, worker: 2 }
    });
  });

  it('auxiliares de perfil', () => {
    assert.equal(otherRole('farmer'), 'worker');
    assert.equal(profileKey('worker'), 'worker_id');
    assert.equal(hasProfile(account({ farmer_id: 1 }), 'farmer'), true);
    assert.equal(hasProfile(account({ farmer_id: 1 }), 'worker'), false);
  });
});
