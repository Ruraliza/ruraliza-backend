// A subida do servidor (main em app.ts): o seed de demonstração cria contas com a senha pública do
// README, então só roda em --dev (npm run dev) ou com SEED_DEMO=true. Em produção (npm start), a
// equipe depende só do administrador de ADMIN_EMAIL/ADMIN_PASSWORD.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { bootContainer } from '../../app';
import type { Container } from '../../src/container';
import { SEED_PASSWORD } from '../../src/seed';

const ENV_KEYS = ['SEED_DEMO', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_NAME'] as const;

const systemLogin = async (c: Container, email: string, password: string): Promise<boolean> =>
  (await c.useCases.systemUsers.systemLogin.execute({ email, password })).ok;
const appLogin = async (c: Container, email: string): Promise<boolean> =>
  (await c.useCases.auth.login.execute({ email, password: SEED_PASSWORD })).ok;

describe('subida do servidor', () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved.set(key, process.env[key]);
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- as chaves são as fixas de ENV_KEYS
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of saved) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- as chaves são as fixas de ENV_KEYS
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('em produção não cria as contas de demonstração; só o administrador do ADMIN_*', async () => {
    process.env['ADMIN_EMAIL'] = 'chefe@ruraliza.app';
    process.env['ADMIN_PASSWORD'] = 'senha-do-env-1';

    const { container, demoSeed } = await bootContainer(false);

    assert.equal(demoSeed, false);
    assert.equal(await systemLogin(container, 'admin@exemplo.com', SEED_PASSWORD), false);
    assert.equal(await systemLogin(container, 'tutor@exemplo.com', SEED_PASSWORD), false);
    assert.equal(await appLogin(container, 'produtor@exemplo.com'), false);
    assert.equal(await systemLogin(container, 'chefe@ruraliza.app', 'senha-do-env-1'), true);
  });

  it('SEED_DEMO precisa ser exatamente "true"', async () => {
    process.env['SEED_DEMO'] = '1';

    const { container, demoSeed } = await bootContainer(false);

    assert.equal(demoSeed, false);
    assert.equal(await systemLogin(container, 'admin@exemplo.com', SEED_PASSWORD), false);
  });

  it('em --dev ou com SEED_DEMO=true, carrega o seed', async () => {
    const dev = await bootContainer(true);
    process.env['SEED_DEMO'] = 'true';
    const demo = await bootContainer(false);

    for (const { container, demoSeed } of [dev, demo]) {
      assert.equal(demoSeed, true);
      assert.equal(await systemLogin(container, 'admin@exemplo.com', SEED_PASSWORD), true);
      assert.equal(await appLogin(container, 'produtor@exemplo.com'), true);
    }
  });
});
