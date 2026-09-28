// Remove do array (no próprio array, pois os models são arrays compartilhados)
// todos os itens que atendem ao predicado. Retorna quantos foram removidos.
// TODO(db): substituir por ON DELETE CASCADE nas chaves estrangeiras.
export function removeWhere<T>(list: T[], predicate: (item: T) => boolean): number {
  let removed = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i];
    if (item !== undefined && predicate(item)) {
      list.splice(i, 1);
      removed++;
    }
  }
  return removed;
}

// Busca por id vindo da URL/corpo (string ou número); ids inválidos simplesmente não encontram nada.
export function findById<T extends { id: number }>(list: readonly T[], id: unknown): T | undefined {
  const wanted = Number(id);
  return list.find((item) => item.id === wanted);
}

// Para relações que o próprio backend mantém (ex.: serviço → fazenda). Se faltar, é bug: vira 500.
export function requireFound<T>(value: T | undefined, description: string): T {
  if (value === undefined) {
    throw new Error(`Inconsistência nos dados: ${description} não encontrado(a).`);
  }
  return value;
}
