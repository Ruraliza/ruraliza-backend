import type { Criteria, Repository } from '../../domain/repository';
import type { Database, Row } from './database';

// Implementação em PostgreSQL de Repository<T, K>: uma tabela por entidade, uma coluna por campo.
// Mesma semântica da versão em memória: `find` é igualdade de campos, na ordem do id; `update` grava
// a entidade inteira e falha se ela não existe; `delete` de quem não existe não faz nada.
//
// Como cada campo vai para a coluna:
// - 'value': tipo simples ou lista simples (text, integer, boolean, timestamptz, date, integer[], text[]);
// - 'json': objeto ou lista de objetos numa coluna jsonb.
// Campo opcional da entidade (`campo?:`) leva '?' no fim: NULL no banco, ausente na entidade.
// O compilador confere que todo campo está na lista e que os opcionais estão marcados.
export type ColumnKind<V> = undefined extends V ? 'value?' | 'json?' : 'value' | 'json';
export type Columns<T> = { readonly [P in Exclude<keyof T, 'id'>]-?: ColumnKind<T[P]> };

const INT4_MAX = 2_147_483_647;

// Os ids são `integer`. Um número fora da faixa não é id de ninguém: responde "não existe" sem ir ao banco
// (que recusaria a consulta com erro, e a rota daria 500 no lugar de 404).
function isInt4(value: number): boolean {
  return Number.isInteger(value) && Math.abs(value) <= INT4_MAX;
}

export class PgRepository<T extends { id: number }, K extends keyof T & string> implements Repository<T, K> {
  private readonly kinds: ReadonlyMap<string, string>;
  private readonly insertSql: string;
  private readonly updateSql: string;

  constructor(
    private readonly db: Database,
    // Nome da tabela e das colunas vêm do código, nunca de quem chama a API; os valores vão sempre por parâmetro.
    private readonly table: string,
    columns: Columns<T>,
    // Campos aceitos em `find` (os mesmos do tipo K).
    private readonly filterable: readonly K[]
  ) {
    this.kinds = new Map<string, string>(Object.entries(columns));
    const names = [...this.kinds.keys()];
    const list = names.map((name) => `"${name}"`).join(', ');
    this.insertSql = `INSERT INTO "${table}" (${list}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
    this.updateSql = `UPDATE "${table}" SET ${names.map((name, i) => `"${name}" = $${i + 2}`).join(', ')} WHERE id = $1`;
  }

  async findById(id: number): Promise<T | undefined> {
    if (!isInt4(id)) return undefined;
    const { rows } = await this.db.query(`SELECT * FROM "${this.table}" WHERE id = $1`, [id]);
    return rows[0] === undefined ? undefined : this.toEntity(rows[0]);
  }

  async find(criteria: Criteria<T, K> = {}): Promise<T[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    for (const key of this.filterable) {
      if (!Object.hasOwn(criteria, key)) continue;
      const value: unknown = criteria[key];
      // Nenhuma linha tem um campo de busca indefinido, nem um id fora da faixa.
      if (value === undefined || (typeof value === 'number' && !isInt4(value))) return [];
      if (value === null) {
        conditions.push(`"${key}" IS NULL`);
      } else {
        values.push(value);
        conditions.push(`"${key}" = $${values.length}`);
      }
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.db.query(`SELECT * FROM "${this.table}"${where} ORDER BY id`, values);
    return rows.map((row) => this.toEntity(row));
  }

  async create(data: Omit<T, 'id'>): Promise<T> {
    const { rows } = await this.db.query(this.insertSql, this.toParams(data));
    const [row] = rows;
    if (row === undefined) throw new Error(`create: a tabela ${this.table} não devolveu o registro criado.`);
    return this.toEntity(row);
  }

  async update(entity: T): Promise<void> {
    const { rowCount } = await this.db.query(this.updateSql, [entity.id, ...this.toParams(entity)]);
    if (rowCount === 0) throw new Error(`update: registro ${entity.id} não existe.`);
  }

  async delete(id: number): Promise<void> {
    if (!isInt4(id)) return;
    await this.db.query(`DELETE FROM "${this.table}" WHERE id = $1`, [id]);
  }

  private toParams(data: Omit<T, 'id'>): unknown[] {
    const source: Row = { ...data };
    return [...this.kinds].map(([name, kind]) => {
      const value = source[name] ?? null;
      // O driver escreveria uma lista JS como array do PostgreSQL; em coluna jsonb ela precisa ir como JSON.
      return value !== null && kind.startsWith('json') ? JSON.stringify(value) : value;
    });
  }

  private toEntity(row: Row): T {
    const entity: Row = { id: row['id'] };
    for (const [name, kind] of this.kinds) {
      const value = row[name];
      if (value === null && kind.endsWith('?')) continue;
      // timestamptz volta como Date; as entidades guardam o instante em ISO 8601 (UTC).
      entity[name] = value instanceof Date ? value.toISOString() : value;
    }
    // A forma da linha é a da entidade: as colunas saem de `Columns<T>` e a tabela, da migração
    // (conferidas juntas em tests/postgres, que compara este repositório com o de memória).
    return entity as T;
  }
}
