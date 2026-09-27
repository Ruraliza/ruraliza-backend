// Array que serve como base de dados em memória para os pagamentos.
const payments = [];

/*
  Estrutura de um Payment:
  { id, service_id, farmer_id, worker_id, value, status (PAYMENT_STATUS), insertion_date }
*/

module.exports = { payments };
