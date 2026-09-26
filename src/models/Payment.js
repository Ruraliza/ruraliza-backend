// Array que servirá como base de dados em memória para os pagamentos
const payments = [];

/* 
  Estrutura esperada de um objeto Payment (baseado na modelagem):
  {
    id: Date.now(), // +ID
    service_id: 9876, // +service_id
    farmer_id: 12345, // +farmer_id
    worker_id: 54321, // +contractor_id (atualizado para worker_id)
    value: 1500.00, // +value
    status: "Concluído", // +status
    insertion_date: "2026-09-26T15:08:19.000Z" // +insertion_date
  }
*/

module.exports = {
  payments
};