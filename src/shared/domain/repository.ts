// Acesso a dados que as regras de negócio enxergam. Tudo é assíncrono desde já:
// a implementação em memória e a futura em PostgreSQL cumprem a mesma interface.
//
// Semântica (igual à de um banco): cada leitura devolve uma cópia; alterar a entidade
// só tem efeito depois de `update`. `create` recebe os dados sem id e devolve a entidade com id.
// Cada módulo declara o seu (ex.: FarmRepository em src/modules/farms/domain).

// Filtro por igualdade nos campos permitidos (vira WHERE campo = valor no banco).
export type Criteria<T, K extends keyof T> = Partial<Pick<T, K>>;

export interface Repository<T extends { id: number }, K extends keyof T> {
  findById(id: number): Promise<T | undefined>;
  find(criteria?: Criteria<T, K>): Promise<T[]>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(entity: T): Promise<void>;
  delete(id: number): Promise<void>;
}
