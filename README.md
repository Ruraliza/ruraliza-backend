# 🌾 Ruraliza - API Backend

O projeto **AgTech Ruraliza** é uma plataforma desenvolvida para conectar proprietários rurais a profissionais e estudantes universitários, facilitando a prestação de serviços operacionais nas fazendas e permitindo a validação de horas de estágio curricular.

Este repositório contém a API Backend construída em **Node.js** com **Express**, estruturada segundo o padrão arquitetural **MVC (Model-View-Controller)**. Atualmente, os dados são armazenados temporariamente **em memória** (Arrays), o que é ideal para testes rápidos e prototipagem sem necessidade de configurar uma base de dados complexa.

---

## 🚀 Como executar o projeto

### Pré-requisitos
Certifique-se de que tem o [Node.js](https://nodejs.org/) instalado na sua máquina.

### 1. Instalar as dependências
Abra o terminal na pasta raiz do projeto e execute o seguinte comando para instalar o Express, CORS e o Dotenv:

```bash
npm install
```
*(Caso não tenha o package.json configurado, instale manualmente: `npm install express cors dotenv`)*

### 2. Iniciar o servidor
Para colocar a API a funcionar, execute:

```bash
node app.js
```
Deverá ver no terminal a mensagem: `🚀 Servidor do Ruraliza rodando na porta 3000`

---

## 📁 Estrutura do Projeto

```text
/ruraliza-backend
├── app.js                         # Ficheiro principal (Entry point)
├── /src
│   ├── /models                    # Estruturas de dados em memória (Tabelas)
│   │   ├── Farmer.js              # Modelo: Produtores Rurais
│   │   ├── Worker.js              # Modelo: Prestadores/Estudantes
│   │   └── Service.js             # Modelo: Serviços
│   │
│   ├── /controllers               # Lógica de negócio da API
│   │   ├── FarmerController.js    # Funções do Produtor
│   │   └── WorkerController.js    # Funções do Trabalhador
│   │
│   └── /routes                    # Endpoints da API
│       ├── farmerRoutes.js        # Rotas em /api/farmers
│       └── workerRoutes.js        # Rotas em /api/workers
```

---

## 🛣️ Rotas da API

Pode utilizar ferramentas como o **Postman**, **Insomnia** ou o próprio **cURL** para testar os endpoints abaixo. Lembre-se que, como a base de dados está em memória, os dados são reiniciados sempre que o servidor for desligado.

### 👨‍🌾 Módulo do Produtor (Farmer)
- **`GET /api/farmers`** : Lista todos os produtores.
- **`POST /api/farmers`** : Regista um novo produtor (Corpo esperado: `email`, `name`, `phone`, `cpf`).
- **`POST /api/farmers/services`** : Solicita a abertura de um serviço no campo.
- **`PATCH /api/farmers/services/:id/analyze`** : Analisa a oferta de um trabalhador e aceita ou recusa (Muda o estado do serviço para 'In Progress').
- **`POST /api/farmers/services/:id/payment`** : Simula a libertação do pagamento e conclui o serviço (Muda o estado para 'Completed').

### 👷‍♂️ Módulo do Trabalhador/Estudante (Worker)
- **`GET /api/workers`** : Lista todos os trabalhadores e estudantes.
- **`POST /api/workers`** : Regista um novo trabalhador (Corpo esperado: `email`, `name`, `phone`, `cpf`, `certificates`, `experience`).
- **`GET /api/workers/services`** : Pesquisa os serviços disponíveis que estão pendentes.
- **`POST /api/workers/services/:id/apply`** : Envia uma candidatura a um serviço específico.

---

## 🛠️ Próximos Passos (To-Do)
- [ ] Implementar a geração de relatórios em PDF para as horas de estágio.
- [ ] Adicionar o módulo de trilhas de qualificação para os estudantes.
- [ ] Substituir o armazenamento em memória por uma base de dados real utilizando o ORM Sequelize (SQLite ou PostgreSQL).