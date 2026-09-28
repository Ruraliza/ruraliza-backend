// Remove do array (no próprio array, pois os models são arrays compartilhados)
// todos os itens que atendem ao predicado. Retorna quantos foram removidos.
// TODO(db): substituir por ON DELETE CASCADE nas chaves estrangeiras.
function removeWhere(list, predicate) {
  let removed = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (predicate(list[i])) {
      list.splice(i, 1);
      removed++;
    }
  }
  return removed;
}

module.exports = { removeWhere };
