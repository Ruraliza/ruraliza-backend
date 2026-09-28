import type { Criteria, Repository } from '../../domain/repositories';

// Implementação em memória de Repository<T, K>. Tudo some quando o processo reinicia.
// Guarda e devolve cópias (structuredClone), para se comportar como um banco:
// quem altera uma entidade precisa chamar `update`.
export class InMemoryRepository<T extends { id: number }, K extends keyof T> implements Repository<T, K> {
  private readonly rows: T[] = [];
  private lastId = 0;

  constructor(
    // Campos aceitos em `find` (os mesmos do tipo K).
    private readonly filterable: readonly K[],
    // Monta a entidade com o id gerado (escrito por tipo concreto, para o compilador conferir).
    private readonly withId: (data: Omit<T, 'id'>, id: number) => T
  ) {}

  findById(id: number): Promise<T | undefined> {
    const row = this.rows.find((r) => r.id === id);
    return Promise.resolve(row === undefined ? undefined : structuredClone(row));
  }

  find(criteria: Criteria<T, K> = {}): Promise<T[]> {
    const keys = this.filterable.filter((key) => Object.hasOwn(criteria, key));
    const rows = this.rows.filter((row) => keys.every((key) => row[key] === criteria[key]));
    return Promise.resolve(rows.map((row) => structuredClone(row)));
  }

  create(data: Omit<T, 'id'>): Promise<T> {
    this.lastId += 1;
    const row = this.withId(structuredClone(data), this.lastId);
    this.rows.push(row);
    return Promise.resolve(structuredClone(row));
  }

  update(entity: T): Promise<void> {
    const index = this.rows.findIndex((r) => r.id === entity.id);
    if (index === -1) {
      return Promise.reject(new Error(`update: registro ${entity.id} não existe.`));
    }
    this.rows[index] = structuredClone(entity);
    return Promise.resolve();
  }

  delete(id: number): Promise<void> {
    const index = this.rows.findIndex((r) => r.id === id);
    if (index !== -1) this.rows.splice(index, 1);
    return Promise.resolve();
  }
}
