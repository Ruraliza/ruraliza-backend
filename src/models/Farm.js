// Array que serve como base de dados em memória para as fazendas.
const farms = [];

/*
  Estrutura de uma Farm:
  { id, farmer_id, address, city, state, insertion_date, deleted_at }
  deleted_at: preenchido quando o produtor remove a fazenda (fica guardada para o histórico dos serviços).
*/

module.exports = { farms };
