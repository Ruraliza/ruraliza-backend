// Array que serve como base de dados em memória para as candidaturas.
const applications = [];

/*
  Estrutura de uma ServiceApplication:
  { id, service_id, worker_id, status (APPLICATION_STATUS), insertion_date }
*/

module.exports = { applications };
