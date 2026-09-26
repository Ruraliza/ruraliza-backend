let nextId = 1;
const farmers = [];

// Dados iniciais para teste (opcional)
farmers.push({
  id: nextId++,
  email: 'produtor@exemplo.com',
  name: 'João Produtor',
  farms: 2,
  phone: '24999999999',
  cpf: '11122233344',
  insertion_date: new Date().toISOString()
});

module.exports = {
  farmers,
  nextId
};