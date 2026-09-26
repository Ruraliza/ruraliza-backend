// src/config/database.js
const { Sequelize } = require('sequelize');

// Aqui configuramos a conexão. 
// Como você ainda não tem o banco, deixaremos preparado para usar SQLite temporariamente 
// ou o Postgres (que você instalou). Vamos deixar no formato Postgres.
const sequelize = new Sequelize(
  process.env.DB_NAME || 'ruraliza_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'sua_senha',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres', // Pode ser trocado para 'sqlite' para testes sem instalar banco
    logging: false,
  }
);

module.exports = sequelize;