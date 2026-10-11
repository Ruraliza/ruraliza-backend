// O seed precisa servir de demonstração para todos os recursos das vagas.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORIES } from '#modules/services';
import type { SessionUser } from '../src/contracts';
import { createContainer } from '../src/container';
import { SEED_PASSWORD, seed } from '../src/seed';

// Meio-dia em Brasília, para os limites de dia ficarem claros.
const NOW = '2026-03-15T15:00:00.000Z';

async function seeded(): Promise<ReturnType<typeof createContainer>> {
  const c = createContainer({ clock: { now: () => NOW } });
  await seed(c.repos, c.clock, c.passwords);
  return c;
}

describe('seed', () => {
  it('tem um serviço por categoria, todos completos e abertos', async () => {
    const c = await seeded();
    const services = await c.repos.services.find();

    assert.deepEqual(services.map((s) => s.category).sort(), [...CATEGORIES].sort());
    for (const s of services) {
      assert.equal(s.status, 'Pending');
      assert.ok(s.description !== null && s.description.length > 0, `serviço ${s.id} sem descrição`);
    }
    // Os serviços citados na documentação continuam com os mesmos ids.
    assert.deepEqual(services.slice(0, 3).map((s) => [s.id, s.name]), [
      [1, 'Colheita de café'], [2, 'Plantio de milho'], [3, 'Conserto de cerca']
    ]);
  });

  it('as contas de teste entram com a senha do seed', async () => {
    const c = await seeded();
    const login = async (email: string): Promise<SessionUser | false> => {
      const r = await c.useCases.auth.login.execute({ email, password: SEED_PASSWORD });
      return r.ok && r.value;
    };
    assert.deepEqual(await login('produtor@exemplo.com'), { account_id: 1, role: 'farmer', id: 1, profiles: { farmer: 1, worker: null } });
    assert.deepEqual(await login('trabalhador@exemplo.com'), { account_id: 2, role: 'worker', id: 1, profiles: { farmer: null, worker: 1 } });
    assert.deepEqual(await login('ambos@exemplo.com'), { account_id: 3, role: 'farmer', id: 2, profiles: { farmer: 2, worker: 2 } });
  });

  it('tem um administrador, que entra só pelo login de sistema', async () => {
    const c = await seeded();
    const admin = await c.useCases.systemUsers.systemLogin.execute({ email: 'admin@exemplo.com', password: SEED_PASSWORD });
    assert.equal(admin.ok && admin.value.role, 'admin');
    const asApp = await c.useCases.auth.login.execute({ email: 'admin@exemplo.com', password: SEED_PASSWORD });
    assert.equal(asApp.ok, false);
  });

  it('as fazendas têm o ponto marcado no mapa', async () => {
    const c = await seeded();
    const farms = await c.repos.farms.find();
    assert.equal(farms.length, 2);
    for (const f of farms) {
      assert.ok(f.latitude !== null && f.latitude >= -90 && f.latitude <= 90, `fazenda ${f.id} sem latitude`);
      assert.ok(f.longitude !== null && f.longitude >= -180 && f.longitude <= 180, `fazenda ${f.id} sem longitude`);
    }
  });

  it('cobre todos os casos de prazo: sem prazo, futuro, hoje e vencido', async () => {
    const c = await seeded();
    const byName = new Map((await c.repos.services.find()).map((s) => [s.name, s.expires_at]));

    assert.equal(byName.get('Conserto de cerca'), null);
    assert.equal(byName.get('Colheita de café'), '2026-03-25');
    assert.equal(byName.get('Pulverização de pasto'), '2026-03-15'); // vence hoje: ainda vale
    assert.equal(byName.get('Limpeza de galpão'), '2026-03-13'); // já vencida
  });

  it('o trabalhador vê 6 vagas (a vencida some); o produtor vê as 7', async () => {
    const c = await seeded();
    const jobs = await c.useCases.services.searchOpenServices.execute();
    assert.equal(jobs.length, 6);
    assert.ok(!jobs.some((j) => j.name === 'Limpeza de galpão'));

    const own = await c.useCases.services.listFarmerServices.execute({ farmerId: 1 });
    assert.equal(own.ok ? own.value.length : -1, 7);
  });

  it('as datas de publicação variam, então filtros de data e ordenação funcionam', async () => {
    const c = await seeded();
    const published = new Set((await c.repos.services.find()).map((s) => s.insertion_date));
    assert.equal(published.size, 7);

    const lastThreeDays = await c.useCases.services.searchOpenServices.execute({ from: '2026-03-12' });
    assert.deepEqual(lastThreeDays.map((j) => j.name).sort(), [
      'Colheita de café', 'Conserto de cerca', 'Pulverização de pasto', 'Vacinação do rebanho'
    ]);

    const recent = await c.useCases.services.searchOpenServices.execute({ sort: 'recent' });
    assert.equal(recent[0]?.name, 'Conserto de cerca'); // publicada hoje
  });
});
