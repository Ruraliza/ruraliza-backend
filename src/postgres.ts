import type { Pool, PoolConfig } from 'pg';
import type { Clock } from '#shared/domain/clock';
import type { PasswordHasher } from '#shared/domain/passwords';
import type { Transaction } from '#shared/domain/transaction';
import { DOCUMENT_URL_PREFIX } from '#shared/infra/documents/in-memory-document-store';
import { IMAGE_URL_PREFIX } from '#shared/infra/images/in-memory-image-store';
import { type Database, asDatabase, createPool, inTransaction } from '#shared/infra/postgres/database';
import { migrate, runOnce } from '#shared/infra/postgres/migrate';
import { PgFileStore } from '#shared/infra/postgres/pg-file-store';
import type { ContainerOptions } from './container';
import { MIGRATIONS } from './migrations';
import { type Repositories, createPostgresRepositories } from './repositories';
import { seed } from './seed';

// Persistência em PostgreSQL: o que entra em createContainer({ ...storage }) no lugar da memória.
// Os avisos para as telas abertas (`changes`) continuam em memória: valem para um processo.
export type PostgresStorage = Required<Pick<ContainerOptions, 'repos' | 'images' | 'documents' | 'idDocuments'>>;

// `db` é o pool ou uma conexão em transação.
export function createPostgresStorage(db: Database): PostgresStorage {
  return {
    repos: createPostgresRepositories(db),
    images: new PgFileStore(db, 'images', IMAGE_URL_PREFIX, 'webp'),
    documents: new PgFileStore(db, 'documents', DOCUMENT_URL_PREFIX, 'pdf'),
    // Privado: fora de GET /api/images (que só procura no store 'images').
    idDocuments: new PgFileStore(db, 'id_documents', IMAGE_URL_PREFIX, 'webp')
  };
}

// Os casos de uso que gravam várias entidades juntas recebem repositórios sobre uma conexão em transação.
export function createPostgresTransaction(pool: Pool): Transaction<Repositories> {
  return (work) => inTransaction(pool, (db) => work(createPostgresRepositories(db)));
}

export interface OpenPostgres {
  pool: Pool;
  storage: PostgresStorage & { transaction: Transaction<Repositories> };
  migrations: string[]; // passos do esquema aplicados nesta chamada
}

// Conecta e aplica os passos pendentes do esquema. Falha aqui (banco fora do ar, URL errada) impede a subida.
export async function openPostgres(connectionString: string, config: PoolConfig = {}): Promise<OpenPostgres> {
  const pool = createPool(connectionString, config);
  try {
    const migrations = await migrate(pool, MIGRATIONS);
    return { pool, storage: { ...createPostgresStorage(asDatabase(pool)), transaction: createPostgresTransaction(pool) }, migrations };
  } catch (error) {
    await pool.end();
    throw error;
  }
}

const DEMO_SEED = 'demo-seed';

// O seed de demonstração roda uma vez por banco, numa transação (inteiro ou nada), e fica anotado junto
// das migrações: nas subidas seguintes não repete, mesmo que alguém tenha apagado uma conta de teste.
// Devolve se criou os dados agora.
export function seedDemoOnce(pool: Pool, clock: Clock, passwords: PasswordHasher): Promise<boolean> {
  return runOnce(pool, DEMO_SEED, async (db) => {
    const { repos, idDocuments } = createPostgresStorage(db);
    await seed(repos, clock, passwords, idDocuments);
  });
}
