let nextId = 1;
const workers = [];

// Dados iniciais para teste (opcional)
workers.push({
  id: nextId++,
  email: 'trabalhador@exemplo.com',
  name: 'Maria Trabalhadora',
  certificates: 'Certificado de Tratorista',
  experience: '5 anos',
  phone: '24988888888',
  cpf: '55566677788',
  insertion_date: new Date().toISOString()
});

module.exports = {
  workers,
  nextId
};