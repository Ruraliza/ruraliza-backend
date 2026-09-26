// Array que servirá como base de dados em memória para as fazendas
const farms = [];

/* 
  Estrutura esperada de um objeto Farm (baseado na modelagem):
  {
    id: Date.now(), // +ID
    farmer_id: 12345, // +farm_id (corrigido para farmer_id)
    address: "Estrada de Terra, Km 2", // +address
    city: "Três Rios", // +city
    state: "RJ", // +state
    insertion_date: "2026-09-26T15:08:19.000Z" // +insertion_date
  }
*/

module.exports = {
  farms
};