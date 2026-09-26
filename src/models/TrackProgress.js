// Array em memória para guardar o progresso dos trabalhadores nas trilhas
const trackProgresses = [];

/* 
  Estrutura esperada de um objeto Track Progress[cite: 4]:
  {
    id: Date.now(), // +ID
    qualification_track_id: 123456789, // +qualification_track_id
    worker_id: 987654321, // +contractor_id (adaptado para worker_id)
    workload_done: 10, // +workload_done (horas já concluídas)
    status: "Em Andamento", // +status (ex: Pendente, Em Andamento, Concluído)
    insertion_date: "2026-09-26T18:00:00.000Z" // +insertion_date
  }
*/

module.exports = {
  trackProgresses
};