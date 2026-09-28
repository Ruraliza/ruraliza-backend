# 🌾 Ruraliza - API Backend

O projeto **AgTech Ruraliza** conecta produtores rurais a trabalhadores, prestadores e estudantes, facilitando a prestação de serviços operacionais nas fazendas.

API em **Node.js + Express 5 + TypeScript**, padrão **MVC**. Nesta fase os dados ficam **em memória** (arrays): tudo some quando o servidor reinicia.

---

## 🚀 Como executar

Pré-requisito: [Node.js](https://nodejs.org/) 20 ou superior.

```bash
npm install
npm run dev              # sobe em http://localhost:3000/api (tsx) e reinicia ao salvar
npm start                # compila para dist/ e sobe o JavaScript gerado
npm test                 # typecheck + lint + smoke
npm run smoke            # percorre o fluxo completo e os casos de erro principais
npm run check:contracts  # confere que o contrato bate com os models do frontend (../ruraliza-frontend)
```

Ao subir, o servidor carrega **dados de teste**: 1 produtor (com 2 fazendas), 1 trabalhador e 3 serviços `Pending` (Colheita, Plantio, Manutenção).

---

## 🔒 Tipagem

- **Compilador estrito** (`tsconfig.json`): `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, entre outros.
- **Sem `any`**: o ESLint com informação de tipos (`npm run lint`) barra `any` explícito e também valores `any` vindos de bibliotecas (`no-unsafe-*`).
- **Entrada validada em tempo de execução**: `req.body` e `req.query` chegam como `unknown`; cada rota valida e converte para o tipo de entrada do contrato (`src/http/body.ts`, parsers nos controllers). Os handlers usam `Handler<Resposta, Params>` (`src/http/types.ts`), então a resposta de cada rota é checada contra o contrato.
- **Contrato com o frontend** (`src/contracts`): entidades, entradas e respostas da API, com os mesmos nomes e formatos de `ruraliza-frontend/src/models`. O `npm run check:contracts` falha se algum tipo divergir em qualquer sentido. Ao mudar um tipo, altere os dois lados e rode o check.

---

## 📁 Estrutura

```text
app.ts                      # Entry point, middlewares, erros, seed
scripts/smoke.ts            # Smoke test do fluxo completo
contract-check/             # Verificação de paridade de tipos com o frontend
src/
  contracts/                # Contrato da API (só tipos): entidades, entradas e respostas
  http/                     # Tipos dos handlers e validação do corpo (unknown → tipo do contrato)
  constants/                # Status e categorias
  data/                     # Gerador de IDs e seed
  models/                   # Arrays em memória (Farmer, Worker, Farm, Service, ServiceApplication, Payment...)
  controllers/              # Regras de negócio
  routes/                   # Endpoints
  utils/                    # Validações (e-mail, CPF), perfil público (CPF mascarado), coleções
```

---

## 🛣️ Rotas

Erros sempre no formato `{ "error": "mensagem" }` com o status correto (400 validação, 404 não encontrado, 409 conflito). POST/PATCH de sucesso devolvem `{ message, <entidade> }`; GET devolve o recurso ou a lista.

Status na API (em inglês): serviço `Pending | In Progress | Completed | Rejected | Cancelled`; candidatura `Pending | Accepted | Rejected`; pagamento `Completed`.

CPF: enviado com 11 dígitos, só números, com dígitos verificadores válidos. Em listas e respostas embutidas sai mascarado (`***.456.789-**`).

### Produtor (`/api/farmers`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/farmers` | Lista produtores |
| POST | `/api/farmers` | Cadastra (`email`, `name`, `phone`, `cpf`); 409 se e-mail/CPF já existe entre produtores |
| GET | `/api/farmers/:id` | Perfil completo (`farms` = lista de IDs das fazendas) |
| PATCH | `/api/farmers/:id` | Edita `email`, `name`, `phone`; 400 se tentar alterar `id`/`cpf` |
| DELETE | `/api/farmers/:id` | Remove o produtor com fazendas, serviços e candidaturas; 409 se houver serviço `In Progress` |
| GET | `/api/farmers/:id/farms` | Fazendas do produtor |
| POST | `/api/farmers/:id/farms` | Cadastra fazenda (`address`, `city`, `state`) |
| PATCH | `/api/farmers/:id/farms/:farmId` | Edita `address`, `city`, `state` |
| DELETE | `/api/farmers/:id/farms/:farmId` | Arquiva a fazenda (`deleted_at`): some das listas, mas os serviços encerrados continuam com ela; 409 se houver serviço `Pending`/`In Progress` |
| GET | `/api/farmers/:id/services?status=` | Serviços do produtor (com `farm` e `applications_pending`) |
| POST | `/api/farmers/services` | Publica serviço (`farmer_id`, `farm_id`, `name`, `category`, `duration` em horas, `price`) |
| GET | `/api/farmers/services/:id` | Serviço com a fazenda |
| PATCH | `/api/farmers/services/:id` | Edita `farm_id`, `name`, `category`, `duration`, `price`; 409 se não estiver `Pending` |
| PATCH | `/api/farmers/services/:id/cancel` | Cancela (`Cancelled`) e recusa as candidaturas pendentes; 409 se não estiver `Pending` |
| GET | `/api/farmers/services/:id/applications` | Candidaturas com o trabalhador embutido |
| PATCH | `/api/farmers/services/:id/analyze` | `{ application_id, action: "Accept" \| "Reject" }` |
| POST | `/api/farmers/services/:id/payment` | Libera pagamento (simulação) de serviço `In Progress`; cria `Payment` |

### Trabalhador (`/api/workers`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/workers` | Lista trabalhadores |
| POST | `/api/workers` | Cadastra (`email`, `name`, `phone`, `cpf`, opcionais `certificates`, `experience`) |
| GET | `/api/workers/:id` | Perfil completo |
| PATCH | `/api/workers/:id` | Edita `email`, `name`, `phone`, `certificates`, `experience`; 400 se tentar alterar `id`/`cpf` |
| DELETE | `/api/workers/:id` | Remove o trabalhador e suas candidaturas; 409 se tiver serviço `In Progress` |
| GET | `/api/workers/:id/applications` | Candidaturas com o serviço embutido |
| GET | `/api/workers/:id/services` | Serviços atribuídos ao trabalhador |
| GET | `/api/workers/services?category=` | Vagas abertas (com cidade/UF da fazenda) |
| GET | `/api/workers/services/:id` | Detalhe da vaga |
| POST | `/api/workers/services/:id/apply` | `{ worker_id }`; 409 se a vaga não está aberta ou já houve candidatura |
| PATCH | `/api/workers/services/:id/withdraw` | `{ worker_id }`; desiste e volta uma etapa: candidatura `Pending` é removida; se já aceito, o serviço volta a `Pending` e as candidaturas recusadas pelo aceite voltam a `Pending`; 409 se recusada ou serviço encerrado |

### Outros
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/categories` | Lista fixa de categorias |

---

## 🛠️ Próximos passos
- [ ] Banco de dados (ver `TODO(db)` no código: IDs, unicidade, transações no aceite/pagamento).
- [ ] Autenticação real.
- [ ] Trilhas de qualificação, registro de horas e relatórios em PDF.
