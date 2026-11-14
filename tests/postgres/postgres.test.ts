// Persistência em PostgreSQL (npm run test:postgres, com TEST_DATABASE_URL apontando para um banco só de testes).
// Prova o que a memória não prova: que os dados continuam depois de reiniciar, que cada tabela guarda e
// devolve a entidade igual ao repositório em memória, e que as restrições barram os duplicados.
import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { bootContainer, createApi } from '../../app';
import { type Container, createContainer } from '../../src/container';
import { MIGRATIONS } from '../../src/migrations';
import { createSupabaseFileStores, seedDemoOnce } from '../../src/postgres';
import { type Repositories, createInMemoryRepositories } from '../../src/repositories';
import { SEED_PASSWORD, seed } from '../../src/seed';
import type { ServiceRepository } from '#modules/services';
import type { PasswordHasher } from '#shared/domain/passwords';
import { InMemoryImageStore } from '#shared/infra/images/in-memory-image-store';
import { PG_UNIQUE_VIOLATION, asDatabase, pgErrorCode } from '#shared/infra/postgres/database';
import { migrate } from '#shared/infra/postgres/migrate';
import type { Fetch } from '#shared/infra/supabase/supabase-file-store';
import { type TestDatabase, TEST_DATABASE_URL, createTestDatabase, dropTestDatabases } from '../support/postgres';

const NOW = '2026-03-15T15:00:00.000Z';
const clock = { now: (): string => NOW };
// Sem sal aleatório, para a memória e o banco guardarem o mesmo hash.
const passwords: PasswordHasher = {
  hash: (password) => Promise.resolve(`plain:${password}`),
  verify: (password, hash) => Promise.resolve(hash === `plain:${password}`)
};

function database(): Promise<TestDatabase> {
  if (TEST_DATABASE_URL === null) assert.fail('Defina TEST_DATABASE_URL (um banco só de testes) para rodar os testes do PostgreSQL.');
  return createTestDatabase(TEST_DATABASE_URL);
}

async function rejectsWithUnique(work: Promise<unknown>): Promise<void> {
  await assert.rejects(work, (error) => pgErrorCode(error) === PG_UNIQUE_VIOLATION);
}

// Produtor, fazenda, vaga, candidatura e aceite: o serviço fica em andamento, pronto para pagar.
async function acceptedService(c: Container): Promise<{ serviceId: number; workerId: number }> {
  const { farmers, farms, workers, services, hiring } = c.useCases;
  const farmer = await farmers.registerFarmer.execute({ email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', password: 'senha-forte-1' });
  assert.ok(farmer.ok);
  const farm = await farms.createFarm.execute({ farmerId: farmer.value.farmer.id, input: { address: 'Sítio', city: 'Três Rios', state: 'RJ', latitude: -22.1165, longitude: -43.2092 } });
  assert.ok(farm.ok);
  const worker = await workers.registerWorker.execute({ email: 'rui@exemplo.com', name: 'Rui', phone: '1', cpf: '11144477735', password: 'senha-forte-1', bio: null, certificates: null, courses: null, experience: null });
  assert.ok(worker.ok);
  const service = await services.publishService.execute({ farmer_id: farmer.value.farmer.id, farm_id: farm.value.id, name: 'Capina', category: 'Manutenção', duration: 4, price: 200 });
  assert.ok(service.ok);
  const application = await hiring.applyForService.execute({ serviceId: service.value.id, workerId: worker.value.worker.id });
  assert.ok(application.ok);
  assert.ok((await hiring.analyzeApplication.execute({ serviceId: service.value.id, application_id: application.value.id, action: 'Accept' })).ok);
  return { serviceId: service.value.id, workerId: worker.value.worker.id };
}

after(dropTestDatabases);

describe('PostgreSQL: esquema e seed', () => {
  it('aplica as migrações uma vez só', async () => {
    const { pool, migrations } = await database();

    assert.deepEqual(migrations, MIGRATIONS.map((m) => m.id));
    assert.deepEqual(await migrate(pool, MIGRATIONS), []);
  });

  it('guarda e devolve cada entidade igual ao repositório em memória (todas as tabelas, com o seed)', async () => {
    const { storage } = await database();
    const memory = createInMemoryRepositories();
    await seed(memory, clock, passwords, new InMemoryImageStore());
    await seed(storage.repos, clock, passwords, storage.idDocuments);

    // O id da foto do documento é sorteado em cada armazenamento; importa se há foto ou não.
    const comparable = (rows: object[]): object[] => rows.map((row) => ('document_id' in row ? { ...row, document_id: row.document_id !== null } : row));
    const empty: string[] = [];
    for (const name of Object.keys(memory) as (keyof Repositories)[]) {
      const [expected, actual] = await Promise.all([memory[name].find(), storage.repos[name].find()]);
      assert.deepEqual(comparable(actual), comparable(expected), `repositório ${name}`);
      if (expected.length === 0) empty.push(name);
    }
    // O seed não cria certificados, avisos de vaga nem inscrições de push: essas tabelas são exercitadas
    // pelos testes de integração e pelo e2e rodando sobre o banco.
    assert.deepEqual(empty.sort(), ['certificates', 'jobAlerts', 'pushSubscriptions']);
  });

  it('o seed de demonstração roda uma vez por banco', async () => {
    const { pool, storage } = await database();

    assert.equal(await seedDemoOnce(pool, clock, passwords), true);
    assert.equal(await seedDemoOnce(pool, clock, passwords), false);
    assert.equal((await storage.repos.systemUsers.find({ email: 'admin@exemplo.com' })).length, 1);
  });
});

describe('PostgreSQL: repositório', () => {
  it('altera só com update, apaga com delete e avisa quando o registro não existe', async () => {
    const { storage: { repos } } = await database();
    const created = await repos.helpArticles.create({ question: 'Como?', answer: 'Assim.', topic: 'conta', position: 1, published: true, updated_at: NOW });

    created.question = 'mudado';
    assert.equal((await repos.helpArticles.findById(created.id))?.question, 'Como?');
    await repos.helpArticles.update(created);
    assert.deepEqual(await repos.helpArticles.find({ topic: 'conta', published: true }), [created]);

    await repos.helpArticles.delete(created.id);
    await repos.helpArticles.delete(created.id); // apagar de novo não é erro
    assert.equal(await repos.helpArticles.findById(created.id), undefined);
    await assert.rejects(repos.helpArticles.update(created), /não existe/);
  });

  it('filtra por nulo, guarda o dia sem hora e deixa de fora o campo opcional não informado', async () => {
    const { storage: { repos } } = await database();
    const base = { farmer_id: 1, farm_id: 1, payment_id: null, name: 'Capina', description: null, category: 'Outros', duration: 2.5, price: 199.9, status: 'Pending' as const, insertion_date: NOW };
    const open = await repos.services.create({ ...base, worker_id: null, expires_at: '2026-03-20' });
    await repos.services.create({ ...base, worker_id: 7, expires_at: null });

    assert.deepEqual(await repos.services.find({ worker_id: null }), [open]);
    assert.equal(open.expires_at, '2026-03-20');
    assert.equal(open.duration, 2.5);
    assert.equal(open.price, 199.9);

    const application = await repos.applications.create({ service_id: open.id, worker_id: 7, status: 'Pending', insertion_date: NOW });
    assert.equal('auto_rejected' in application, false);
    await repos.applications.update({ ...application, auto_rejected: true });
    assert.equal((await repos.applications.findById(application.id))?.auto_rejected, true);
  });

  it('id fora da faixa do banco é "não existe", não erro', async () => {
    const { storage: { repos } } = await database();

    assert.equal(await repos.farmers.findById(99_999_999_999), undefined);
    assert.deepEqual(await repos.farms.find({ farmer_id: 99_999_999_999 }), []);
    await repos.farmers.delete(99_999_999_999);
  });

  it('as restrições barram o duplicado que passaria por duas requisições ao mesmo tempo', async () => {
    const { storage: { repos } } = await database();
    const application = { service_id: 1, worker_id: 1, status: 'Pending' as const, insertion_date: NOW };
    await repos.applications.create(application);
    await rejectsWithUnique(repos.applications.create(application));

    // Um serviço não fica com duas candidaturas aceitas.
    await repos.applications.create({ ...application, worker_id: 2, status: 'Accepted' });
    await rejectsWithUnique(repos.applications.create({ ...application, worker_id: 3, status: 'Accepted' }));

    const payment = { service_id: 1, farmer_id: 1, worker_id: 1, value: 100, status: 'Completed' as const, insertion_date: NOW };
    await repos.payments.create(payment);
    await rejectsWithUnique(repos.payments.create(payment));

    const user = { email: 'a@exemplo.com', name: 'A', role: 'tutor' as const, password_hash: 'x', insertion_date: NOW };
    await repos.systemUsers.create(user);
    await rejectsWithUnique(repos.systemUsers.create(user));
  });
});

describe('PostgreSQL: duas requisições ao mesmo tempo', () => {
  it('cadastros iguais juntos: um entra, os outros recebem 409 (nunca 500, nunca dois registros)', async () => {
    const { storage } = await database();
    const container = createContainer({ clock, passwords, ...storage });
    const server = createApi(container).app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const signup = (): Promise<Response> => fetch(`http://localhost:${port}/api/farmers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ana@exemplo.com', name: 'Ana', phone: '24999999999', cpf: '52998224725', password: 'senha-forte-1', accept_terms: true })
      });

      const responses = await Promise.all([signup(), signup(), signup()]);

      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409, 409]);
      assert.equal((await container.repos.farmers.find({ email: 'ana@exemplo.com' })).length, 1);
      assert.equal((await container.repos.accounts.find({ email: 'ana@exemplo.com' })).length, 1);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});

describe('PostgreSQL: arquivos', () => {
  it('guarda, devolve e apaga os bytes; cada armazenamento só acha os seus', async () => {
    const { storage: { images, documents, idDocuments } } = await database();
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);

    const imageId = await images.save({ bytes, contentType: 'image/webp', width: 1, height: 1 });
    const stored = await images.get(imageId);
    assert.ok(stored);
    assert.deepEqual(stored.bytes, bytes);
    assert.equal(stored.contentType, 'image/webp');
    assert.equal(images.idFromUrl(images.urlFor(imageId)), imageId);

    // A foto do documento de identidade é privada: a rota pública das imagens não a encontra.
    const privateId = await idDocuments.save({ bytes, contentType: 'image/webp', width: 1, height: 1 });
    assert.equal(await images.get(privateId), undefined);
    assert.equal(await documents.get(imageId), undefined);

    await images.delete(imageId);
    assert.equal(await images.get(imageId), undefined);
  });
});

describe('PostgreSQL: arquivos no Supabase Storage', () => {
  it('com o bucket ligado, o que já estava em stored_files continua sendo lido e apagado', async () => {
    const { pool, storage } = await database();
    const bytes = new Uint8Array([7, 8, 9]);
    const oldId = await storage.images.save({ bytes, contentType: 'image/webp', width: 1, height: 1 });
    // Bucket vazio: toda leitura responde "não encontrado".
    const emptyBucket: Fetch = () => Promise.resolve(new Response('{}', { status: 404 }));
    const files = createSupabaseFileStores({ url: 'https://projeto.supabase.co', serviceKey: 'chave', bucket: 'ruraliza' }, asDatabase(pool), emptyBucket);

    assert.deepEqual((await files.images.get(oldId))?.bytes, bytes);
    assert.equal(await files.idDocuments.get(oldId), undefined);
    await files.images.delete(oldId);
    assert.equal(await storage.images.get(oldId), undefined);
  });
});

describe('PostgreSQL: subida do servidor', () => {
  // SUPABASE_* sai do ambiente: estes testes nunca tocam o bucket do .env de quem roda.
  const ENV_KEYS = ['DATABASE_URL', 'SEED_DEMO', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_NAME', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_BUCKET'] as const;
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

  it('os dados continuam depois de reiniciar, e o seed não repete', async () => {
    process.env['DATABASE_URL'] = (await database()).url;

    const first = await bootContainer(false);
    assert.equal(first.storage, 'postgres');
    assert.equal(first.seededNow, true);
    // O CPF do João (seed) já existe: o cadastro repetido é recusado pelo caso de uso, antes de chegar ao banco.
    const repeated = await first.container.useCases.farmers.registerFarmer.execute({ email: 'outra@exemplo.com', name: 'Outra', phone: '1', cpf: '52998224725', password: 'senha-forte-1' });
    assert.equal(repeated.ok, false);
    const created = await first.container.useCases.farmers.registerFarmer.execute({ email: 'nova@exemplo.com', name: 'Nova', phone: '1', cpf: '86288366757', password: 'senha-forte-1' });
    assert.equal(created.ok, true);
    await first.close();

    const second = await bootContainer(false);
    assert.equal(second.seededNow, false);
    assert.equal((await second.container.useCases.auth.login.execute({ email: 'nova@exemplo.com', password: 'senha-forte-1' })).ok, true);
    assert.equal((await second.container.useCases.auth.login.execute({ email: 'produtor@exemplo.com', password: SEED_PASSWORD })).ok, true);
    assert.equal((await second.container.repos.farmers.find({ email: 'produtor@exemplo.com' })).length, 1);
    await second.close();
  });

  it('sem seed, o administrador padrão fica gravado e a senha sorteada depois não o substitui', async () => {
    process.env['DATABASE_URL'] = (await database()).url;
    process.env['SEED_DEMO'] = 'false';

    const first = await bootContainer(false);
    assert.equal(first.adminStatus, 'created');
    assert.ok(first.initialAdmin);
    const { email, password } = first.initialAdmin;
    await first.close();

    const second = await bootContainer(false);
    assert.equal(second.adminStatus, 'exists');
    assert.equal((await second.container.useCases.systemUsers.systemLogin.execute({ email, password })).ok, true);
    await second.close();
  });

  it('um fluxo de contratação inteiro grava em todas as tabelas envolvidas', async () => {
    const { storage } = await database();
    const c = createContainer({ clock, passwords, ...storage });
    const { serviceId, workerId } = await acceptedService(c);

    assert.ok((await c.useCases.hiring.payService.execute({ serviceId })).ok);
    await c.notifier.idle();

    assert.equal((await c.repos.services.findById(serviceId))?.status, 'Completed');
    assert.equal((await c.repos.payments.find({ service_id: serviceId })).length, 1);
    assert.equal((await c.repos.chats.find({ service_id: serviceId })).length, 1);
    assert.ok((await c.repos.notifications.find({ role: 'worker', profile_id: workerId })).length > 0);
    // Pagar de novo é recusado pela regra (o serviço já está concluído).
    assert.equal((await c.useCases.hiring.payService.execute({ serviceId })).ok, false);
  });

  it('pagamento que falha no meio não grava nada, e o serviço pode ser pago de novo', async () => {
    const { storage } = await database();
    // O banco "cai" na segunda gravação do pagamento (a conclusão do serviço), dentro da transação.
    let down = true;
    const flaky = (services: ServiceRepository): ServiceRepository => ({
      findById: (id) => services.findById(id),
      find: (criteria) => services.find(criteria),
      create: (data) => services.create(data),
      delete: (id) => services.delete(id),
      update: (service) => (down ? Promise.reject(new Error('queda do banco')) : services.update(service))
    });
    const c = createContainer({
      clock, passwords, ...storage,
      transaction: (work) => storage.transaction((repos) => work({ ...repos, services: flaky(repos.services) }))
    });
    down = false;
    const { serviceId } = await acceptedService(c);
    down = true;

    await assert.rejects(c.useCases.hiring.payService.execute({ serviceId }), /queda do banco/);
    assert.deepEqual(await c.repos.payments.find({ service_id: serviceId }), []);
    assert.equal((await c.repos.services.findById(serviceId))?.status, 'In Progress');

    down = false;
    assert.ok((await c.useCases.hiring.payService.execute({ serviceId })).ok);
    assert.equal((await c.repos.payments.find({ service_id: serviceId })).length, 1);
    assert.equal((await c.repos.services.findById(serviceId))?.status, 'Completed');
    await c.notifier.idle();
  });
});
