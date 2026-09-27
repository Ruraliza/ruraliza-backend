// Gerador de IDs incrementais por entidade (em memória).
// TODO(db): ao migrar para banco, o ID passa a ser gerado pelo próprio banco (serial/identity).
const counters = {};

function nextId(entity) {
  if (typeof entity !== 'string' || entity.length === 0) {
    throw new Error('nextId(entity) requires a non-empty entity name.');
  }
  counters[entity] = (counters[entity] || 0) + 1;
  return counters[entity];
}

module.exports = { nextId };
