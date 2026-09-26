// src/models/Service.js
let nextId = 1;
const services = [];

module.exports = {
  services,
  nextId: () => nextId++ // Função para garantir um novo ID a cada chamada
};