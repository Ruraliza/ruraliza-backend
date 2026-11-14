import type { Pool, PoolConfig } from 'pg';
import type { Clock } from '#shared/domain/clock';
import type { SupabaseStorageSettings } from '#shared/config';
import type { ImageStore } from '#shared/domain/images';
import type { PasswordHasher } from '#shared/domain/passwords';
import type { Transaction } from '#shared/domain/transaction';
import { DOCUMENT_URL_PREFIX } from '#shared/infra/documents/in-memory-document-store';
import { IMAGE_URL_PREFIX } from '#shared/infra/images/in-memory-image-store';
import { type Database, asDatabase, createPool, inTransaction } from '#shared/infra/postgres/database';
import { migrate, runOnce } from '#shared/infra/postgres/migrate';
import { PgFileStore } from '#shared/infra/postgres/pg-file-store';
import { type Fetch, SupabaseFileStore } from '#shared/infra/supabase/supabase-file-store';
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

export type FileStores = Pick<PostgresStorage, 'images' | 'documents' | 'idDocuments'>;

// Os arquivos num bucket privado do Supabase Storage, no lugar da tabela `stored_files`. As pastas têm os
// nomes dos `store` da tabela, e o que já estava nela continua sendo lido (e apagado) por lá.
export function createSupabaseFileStores(settings: SupabaseStorageSettings, db: Database, request?: Fetch): FileStores {
  const previous = createPostgresStorage(db);
  return {
    images: new SupabaseFileStore(settings, 'images', IMAGE_URL_PREFIX, 'webp', previous.images, request),
    documents: new SupabaseFileStore(settings, 'documents', DOCUMENT_URL_PREFIX, 'pdf', previous.documents, request),
    idDocuments: new SupabaseFileStore(settings, 'id_documents', IMAGE_URL_PREFIX, 'webp', previous.idDocuments, request)
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
// Devolve se criou os dados agora. `idDocuments`: onde vão as fotos de documento do seed quando os arquivos
// ficam fora do banco (se a transação desfizer, a foto já enviada sobra no bucket, sem uso).
export function seedDemoOnce(pool: Pool, clock: Clock, passwords: PasswordHasher, idDocuments?: ImageStore): Promise<boolean> {
  return runOnce(pool, DEMO_SEED, async (db) => {
    const storage = createPostgresStorage(db);
    await seed(storage.repos, clock, passwords, idDocuments ?? storage.idDocuments);
  });
}
