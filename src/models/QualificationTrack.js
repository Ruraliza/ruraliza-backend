// Array em memória para guardar as trilhas de qualificação disponíveis
const qualificationTracks = [];

/* 
  Estrutura esperada de um objeto Qualification Track:
  {
    id: Date.now(), // +ID
    name: "Operação de Maquinário Pesado", // +name
    description: "Capacitação para operação de tratores e colheitadeiras.", // +description
    workload: 40, // +workload (carga horária total)
    category: "Maquinário", // +category
    insertion_date: "2026-09-26T18:00:00.000Z" // +insertion_date
  }
*/

module.exports = {
  qualificationTracks
};