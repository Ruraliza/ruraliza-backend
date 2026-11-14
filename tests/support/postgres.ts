// Banco de teste: com TEST_DATABASE_URL, os testes de integração e o e2e rodam sobre o PostgreSQL no lugar
// da memória. Cada container ganha um schema novo e vazio, apagado no fim, então os testes não se enxergam
// nem deixam nada para trás. Use um banco só de testes: nunca o de desenvolvimento nem o de produção.
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { type Database, asDatabase } from '#shared/infra/postgres/database';
import type { ContainerOptions } from '../../src/container';
import { type OpenPostgres, createPostgresStorage, createPostgresTransaction, openPostgres } from '../../src/postgres';

export const TEST_DATABASE_URL: string | null = (process.env['TEST_DATABASE_URL'] ?? '').trim() || null;

export interface TestDatabase extends OpenPostgres {
  schema: string;
  // A mesma conexão em forma de DATABASE_URL (já apontando para o schema), para testar a subida do servidor.
  url: string;
}

const created: TestDatabase[] = [];

async function admin(url: string, sql: string): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

// Schema novo, com as migrações aplicadas. As conexões ociosas fecham logo e não seguram o processo.
export async function createTestDatabase(url: string): Promise<TestDatabase> {
  const schema = `ruraliza_test_${randomBytes(6).toString('hex')}`;
  await admin(url, `CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set('options', `-c search_path=${schema}`);
  const opened = await openPostgres(scoped.toString(), { max: 4, idleTimeoutMillis: 500, allowExitOnIdle: true });
  const database = { ...opened, schema, url: scoped.toString() };
  created.push(database);
  return database;
}

// Fecha as conexões e apaga os schemas criados por este processo.
export async function dropTestDatabases(): Promise<void> {
  if (TEST_DATABASE_URL === null) return;
  for (const database of created.splice(0)) {
    await database.pool.end().catch(() => undefined); // já fechado pelo próprio teste
    await admin(TEST_DATABASE_URL, `DROP SCHEMA IF EXISTS ${database.schema} CASCADE`);
  }
}

// Para createContainer({ ...testStorage() }): vazio sem TEST_DATABASE_URL (memória); com ela, um schema novo.
// O container é montado na hora (createContainer não espera nada), então o schema é criado em segundo
// plano e a primeira consulta espera por ele.
export function testStorage(): ContainerOptions {
  if (TEST_DATABASE_URL === null) return {};
  const ready = createTestDatabase(TEST_DATABASE_URL);
  ready.catch(() => undefined); // a falha aparece na primeira consulta
  const db: Database = {
    query: async (text, values) => asDatabase((await ready).pool).query(text, values)
  };
  return { ...createPostgresStorage(db), transaction: async (work) => createPostgresTransaction((await ready).pool)(work) };
}
