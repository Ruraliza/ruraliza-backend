import { Pool, type PoolClient, type PoolConfig, types } from 'pg';

// Acesso ao PostgreSQL com o driver `pg`. Tudo o que fala SQL fica nesta pasta e nos `infra/pg-*.ts` dos módulos.

// `date` (dia do calendário, sem hora) volta como o texto AAAA-MM-DD, igual ao que as entidades guardam.
// Sem isto, o driver devolveria um Date à meia-noite do fuso do servidor.
types.setTypeParser(types.builtins.DATE, (value) => value);

export type Row = Record<string, unknown>;

// O que os repositórios precisam do banco: uma consulta com parâmetros. O pool cumpre, e uma conexão
// dentro de uma transação também (ver inTransaction).
export interface Database {
  query(text: string, values?: readonly unknown[]): Promise<{ rows: Row[]; rowCount: number }>;
}

// Um pool por processo. `config` serve para os testes (schema isolado, poucas conexões).
export function createPool(connectionString: string, config: PoolConfig = {}): Pool {
  const pool = new Pool({ connectionString, ...config });
  // Uma conexão ociosa que cai emite 'error' no pool; sem ouvinte, o processo inteiro cairia.
  // Só a mensagem vai para o log: o erro completo pode trazer dados da conexão.
  pool.on('error', (error) => console.error('Conexão ociosa com o PostgreSQL caiu:', error.message));
  return pool;
}

export function asDatabase(executor: Pool | PoolClient): Database {
  return {
    query: async (text, values) => {
      const result = await executor.query<Row>(text, values === undefined ? [] : [...values]);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    }
  };
}

// Roda `work` numa transação: tudo o que ele fizer pelo `Database` recebido vale junto ou não vale.
export async function inTransaction<T>(pool: Pool, work: (db: Database) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(asDatabase(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined); // o erro que importa é o original
    throw error;
  } finally {
    client.release();
  }
}

// Erros do PostgreSQL que o chamador pode tratar (https://www.postgresql.org/docs/current/errcodes-appendix.html).
export const PG_UNIQUE_VIOLATION = '23505';
// Valor que o banco não aceita: número fora da faixa da coluna, texto com byte nulo.
export const PG_INVALID_VALUE_CODES: readonly string[] = ['22003', '22021', '22P05'];

export function pgErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}
