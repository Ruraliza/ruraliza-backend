// A subida do servidor (main em app.ts): o seed cria as contas de teste com a senha pública do README e
// roda sempre, enquanto o app é só de demonstração. SEED_DEMO=false desliga; aí a equipe depende do
// administrador de ADMIN_EMAIL/ADMIN_PASSWORD ou do administrador padrão com senha sorteada.
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

  it('em produção, por padrão, carrega as contas de teste (fase de demonstração)', async () => {
    const { container, demoSeed, generatedPassword } = await bootContainer(false);

    assert.equal(demoSeed, true);
    assert.equal(generatedPassword, false);
    assert.equal(await systemLogin(container, 'admin@exemplo.com', SEED_PASSWORD), true);
    assert.equal(await appLogin(container, 'produtor@exemplo.com'), true);
    assert.equal(await appLogin(container, 'trabalhador@exemplo.com'), true);
    assert.equal(await appLogin(container, 'ambos@exemplo.com'), true);
  });

  it('com SEED_DEMO=false não cria as contas de teste; só o administrador do ADMIN_*', async () => {
    process.env['SEED_DEMO'] = 'false';
    process.env['ADMIN_EMAIL'] = 'chefe@ruraliza.app';
    process.env['ADMIN_PASSWORD'] = 'senha-do-env-1';

    const { container, demoSeed } = await bootContainer(false);

    assert.equal(demoSeed, false);
    assert.equal(await systemLogin(container, 'admin@exemplo.com', SEED_PASSWORD), false);
    assert.equal(await appLogin(container, 'produtor@exemplo.com'), false);
    assert.equal(await systemLogin(container, 'chefe@ruraliza.app', 'senha-do-env-1'), true);
  });

  it('com SEED_DEMO=false e sem ADMIN_*, cria o administrador padrão com uma senha sorteada', async () => {
    process.env['SEED_DEMO'] = 'false';
    const first = await bootContainer(false);
    const second = await bootContainer(false);

    assert.ok(first.initialAdmin);
    assert.equal(first.initialAdmin.email, 'admin@ruraliza.app');
    assert.equal(first.adminStatus, 'created');
    assert.equal(first.generatedPassword, true);
    const { password } = first.initialAdmin;
    assert.ok(password.length >= 16);
    assert.notEqual(password, second.initialAdmin?.password);
    assert.equal(await systemLogin(first.container, 'admin@ruraliza.app', password), true);
  });

  it('em --dev carrega o seed mesmo com SEED_DEMO=false', async () => {
    process.env['SEED_DEMO'] = 'false';
    const { container, demoSeed } = await bootContainer(true);

    assert.equal(demoSeed, true);
    assert.equal(await systemLogin(container, 'admin@exemplo.com', SEED_PASSWORD), true);
  });
});
