import type { Pool } from 'pg';
import { type Database, inTransaction } from './database';

// Migrações: cada passo roda uma vez por banco, em ordem, e fica anotado em `schema_migrations`.
// Um passo já aplicado nunca é editado: mudança de esquema é um passo novo no fim da lista.

export interface Migration {
  id: string;
  sql: string;
}

// Trava do PostgreSQL que vale até o fim da transação (o número é só um nome): com duas instâncias
// subindo juntas, uma espera a outra.
const MIGRATION_LOCK = 7_272_612;

// Roda `work` se o passo `id` ainda não foi aplicado, na mesma transação que o anota: ou acontece
// tudo e fica anotado, ou nada. Devolve se rodou agora.
export function runOnce(pool: Pool, id: string, work: (db: Database) => Promise<void>): Promise<boolean> {
  return inTransaction(pool, async (db) => {
    await db.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);
    await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = await db.query('SELECT 1 FROM schema_migrations WHERE id = $1', [id]);
    if (applied.rowCount > 0) return false;
    await work(db);
    await db.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
    return true;
  });
}

// Aplica os passos pendentes. Devolve os ids aplicados nesta chamada.
export async function migrate(pool: Pool, migrations: readonly Migration[]): Promise<string[]> {
  const applied: string[] = [];
  for (const migration of migrations) {
    const ran = await runOnce(pool, migration.id, async (db) => {
      await db.query(migration.sql);
    });
    if (ran) applied.push(migration.id);
  }
  return applied;
}
