# 🌾 Ruraliza - API Backend

O projeto **AgTech Ruraliza** conecta produtores rurais a trabalhadores, prestadores e estudantes, facilitando a prestação de serviços operacionais nas fazendas.

API em **Node.js + Express 5 + TypeScript**, padrão **MVC**. Nesta fase os dados e as fotos ficam **em memória**: tudo some quando o servidor reinicia. A troca para PostgreSQL está preparada; veja [Armazenamento](#-armazenamento-temporário-e-migração-para-postgresql).

---

## 🚀 Como executar

Pré-requisito: [Node.js](https://nodejs.org/) 20 ou superior.

```bash
cp .env.example .env     # configuração local (porta, chave do Google Maps)
npm install
npm run dev              # sobe em http://localhost:3000/api (tsx) e reinicia ao salvar
npm start                # compila para dist/ e sobe o JavaScript gerado
npm test                 # typecheck + lint + testes unitários + smoke
npm run test:unit        # só os testes dos casos de uso (sem HTTP)
npm run smoke            # percorre o fluxo completo e os casos de erro principais
npm run check:contracts  # confere que o contrato bate com os models do frontend (../ruraliza-frontend)
```

Ao subir, o servidor carrega **dados de teste**: 1 produtor (com 2 fazendas), 1 trabalhador e 7 serviços `Pending`, um por categoria, publicados nos últimos 12 dias e com todos os casos de prazo (sem prazo, vence em alguns dias, vence hoje e o serviço 7 já vencido, que só o produtor vê). As datas são relativas ao dia em que o servidor sobe.

### Usuários de teste

Criados pelo seed (`src/data/seed.ts`) a cada vez que o servidor sobe. Para entrar, escolha o tipo de perfil na tela **Entrar** (ou envie `role` em `POST /api/auth/login`).

| Tipo (`role`) | ID | Nome | E-mail | Senha | CPF | Dados |
|---|---|---|---|---|---|---|
| Produtor (`farmer`) | 1 | João Produtor | `produtor@exemplo.com` | `ruraliza123` | `52998224725` | Fazendas 1 (São José, Três Rios/RJ) e 2 (Boa Vista, Paraíba do Sul/RJ); serviços 1 a 7 |
| Trabalhador (`worker`) | 1 | Maria Trabalhadora | `trabalhador@exemplo.com` | `ruraliza123` | `11144477735` | Perfil completo (apresentação, experiência, certificado e curso), sem foto e sem currículo; nenhuma candidatura |

Se você trocar a senha de um deles (pelo perfil ou por "Esqueci minha senha"), ela volta a ser `ruraliza123` quando o servidor reinicia, porque os dados ficam em memória.

### Configuração (`.env`)

As variáveis ficam no `.env` (fora do git). O `.env.example` traz cada uma com instruções:

| Variável | Para quê |
|---|---|
| `PORT` | Porta do servidor (padrão 3000) |
| `CORS_ORIGINS` | Origens (separadas por vírgula) aceitas pelo CORS e por `GET /api/config/maps`. Sem ela, só `https://ruraliza.github.io`. Em `npm run dev` o CORS aceita qualquer origem, mas a rota do mapa continua restrita. No `.env` local use `http://localhost:4200`; no Render, não defina |
| `GOOGLE_MAPS_API_KEY` | Chave do Google Maps Platform (Maps JavaScript API + Geocoding API + Maps Embed API). Entregue ao frontend por `GET /api/config/maps`, então **restrinja por HTTP referrer** no Google Cloud. Sem ela, essa rota responde 503 e o mapa fica indisponível |
| `GOOGLE_MAPS_MAP_ID` | Map ID para o alfinete arrastável (padrão `DEMO_MAP_ID`, só para desenvolvimento) |

Em produção (Render), cadastre as mesmas variáveis no painel do serviço.

---

## 📖 Documentação (Swagger / OpenAPI)

Com o servidor rodando:

- **Swagger UI**: http://localhost:3000/api/docs (dá para testar as rotas pelo "Try it out")
- **OpenAPI 3.0 (JSON)**: http://localhost:3000/api/docs/openapi.json

A documentação é gerada do mesmo lugar em que as rotas são declaradas (`src/routes/*`, com `route(método, caminho, handler, operation({...}))`), então não existe rota sem documentação. Os schemas ficam em `src/docs/schemas.ts`.

O `npm run smoke` confere **toda resposta** contra o documento: a rota e o status precisam estar documentados e o corpo precisa bater com o schema (campos a mais também falham). Ao mudar uma resposta, atualize o schema, senão o smoke acusa.

---

## 🔒 Tipagem

- **Compilador estrito** (`tsconfig.json`): `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, entre outros.
- **Sem `any`**: o ESLint com informação de tipos (`npm run lint`) barra `any` explícito e também valores `any` vindos de bibliotecas (`no-unsafe-*`).
- **Entrada validada em tempo de execução**: `req.body` e `req.query` chegam como `unknown`; cada rota valida e converte para o tipo de entrada do contrato (`src/http/body.ts`, parsers nos controllers). Os handlers usam `Handler<Resposta, Params>` (`src/http/types.ts`), então a resposta de cada rota é checada contra o contrato.
- **Contrato com o frontend** (`src/contracts`): entidades, entradas e respostas da API, com os mesmos nomes e formatos de `ruraliza-frontend/src/models`. O `npm run check:contracts` falha se algum tipo divergir em qualquer sentido. Ao mudar um tipo, altere os dois lados e rode o check.

---

## 📁 Estrutura

```text
app.ts                      # createApi(container): middlewares, docs, rotas, erros; e o start do servidor
scripts/smoke.ts            # Smoke test do fluxo completo (HTTP)
scripts/openapi-check.ts    # Confere cada resposta do smoke contra o OpenAPI
tests/                      # Testes unitários dos casos de uso (sem HTTP)
contract-check/             # Verificação de paridade de tipos com o frontend
src/
  container.ts              # Raiz de composição: escolhe os repositórios e monta os casos de uso
  contracts/                # Contrato da API (só tipos): entidades, entradas e respostas
  domain/                   # Result, interfaces dos repositórios, das imagens (ImageStore/ImageProcessor) e dos documentos (DocumentStore), Clock, datas
  infra/memory/             # Repositórios, ImageStore e DocumentStore em memória (implementam as interfaces de domain/)
  infra/crypto/             # Hash das senhas (scrypt) e tokens de redefinição, com node:crypto
  infra/images/             # SharpImageProcessor: redimensiona para até 1000 px (perfil: quadrado) e converte para WebP
  usecases/                 # Regras de negócio: Auth, Farmer, Farm, Worker, Service, Hiring, Photo, Resume
  controllers/              # HTTP fino: valida o corpo, chama o caso de uso, traduz o Result em status
  http/                     # Tipos dos handlers, route(), parsers dos corpos e tradução de erros
  routes/                   # Endpoints + documentação de cada um (index.ts monta controllers e grupos)
  docs/                     # OpenAPI: schemas, helpers de operação e montagem do documento
  constants/                # Status e categorias
  data/                     # Seed de demonstração
  models/                   # Entidades ainda sem rotas (trilhas de qualificação)
  utils/                    # Validações (e-mail, CPF) e perfil público (CPF mascarado)
```

### Camadas

`routes → controllers → usecases → domain ← infra`. Os casos de uso dependem só das interfaces em `src/domain/repositories.ts`, nunca da implementação. Para trocar a persistência (ex.: PostgreSQL), escreva repositórios que cumpram essas interfaces e passe-os em `createContainer({ repos })`; controllers, rotas e regras não mudam. Os repositórios devolvem cópias (como um banco): alterar uma entidade só vale depois de `update`.

---

## 💾 Armazenamento temporário e migração para PostgreSQL

### Como está hoje (sem banco)

| O quê | Onde fica | Implementação |
|---|---|---|
| Produtores, trabalhadores, fazendas, serviços, candidaturas, pagamentos | Array em memória, um por entidade, com id sequencial | `InMemoryRepository` (`src/infra/memory/`) |
| Fotos (perfil do produtor, perfil do trabalhador, fazendas) | `Map` em memória de id para bytes WebP | `InMemoryImageStore` (`src/infra/memory/InMemoryImageStore.ts`) |
| Tratamento das fotos | Processado no upload, não é guardado | `SharpImageProcessor` (`src/infra/images/`) |
| Senhas (hash) e pedidos de redefinição | Array em memória, separado dos perfis | `InMemoryRepository` de `Credential` (`src/domain/passwords.ts`) |
| Currículos dos trabalhadores (PDF) | `Map` em memória de id para bytes do PDF | `InMemoryDocumentStore` (`src/infra/memory/InMemoryDocumentStore.ts`) |

- Os repositórios já são **assíncronos** e devolvem **cópias** (`structuredClone`). Eles se comportam como um banco: o resto do código não sabe que é memória.
- As entidades guardam **só a URL** da foto (`photo_url`, `farm.photos[].url`), nunca os bytes. Hoje a URL é `/api/images/<uuid>.webp`, servida por `GET /api/images/:id` com cache imutável.
- Toda foto enviada passa pelo `SharpImageProcessor` antes de ser guardada: corrige a rotação do celular, reduz para **no máximo 1000 px no maior lado** (sem ampliar fotos pequenas), converte para **WebP (qualidade 78)** e remove os metadados (EXIF/GPS). Fotos de perfil saem sempre **quadradas** (até 1000×1000 px): o app envia a foto já recortada pelo usuário e, se chegar outra proporção, o servidor recorta o quadrado central. Arquivos que não são imagem são recusados com 400. Uploads acima de 10 MB são recusados com 413.
- O currículo do trabalhador segue o mesmo esquema, sem processamento: o PDF é guardado como chegou, depois de conferir a assinatura `%PDF-` (outro arquivo dá 400; acima de 5 MB, 413). O trabalhador guarda só `resume_url` (`/api/documents/<uuid>.pdf`), servida por `GET /api/documents/:id`.
- A senha **não fica no perfil**: vai para o repositório `credentials` (`role`, `user_id`, `password_hash`), então nunca sai numa resposta. O hash é **scrypt** com sal aleatório (`src/infra/crypto/NodeCrypto.ts`). O pedido de "esqueci a senha" guarda só o SHA-256 do token, com validade de 30 minutos.
- A escolha de tudo isso está num lugar só: `src/container.ts` (`createContainer`).

### Como ligar o PostgreSQL

1. **Repositórios.** Crie `src/infra/postgres/` (com `pg` ou Sequelize, que já estão nas dependências) com uma classe por entidade implementando `Repository<T, K>` de `src/domain/repositories.ts` (`findById`, `find(criteria)`, `create`, `update`, `delete`). `find(criteria)` é só igualdade de campos (`WHERE campo = $1 AND ...`). Monte um `createPostgresRepositories(conexão)` que devolva o objeto `Repositories`.
2. **Container.** Em `app.ts` (no bloco que sobe o servidor), troque `createContainer()` por `createContainer({ repos: createPostgresRepositories(conexão) })`. Rotas, controllers e regras não mudam.
3. **Tabelas.** Os campos são exatamente os de `src/contracts/`. Pontos de atenção:
   - `farm.photos` → tabela `farm_photos (id text, farm_id int references farms, url text, position int)`, ou coluna `jsonb`.
   - `expires_at` → `date` (dia do calendário, sem hora). A vaga vale até o fim desse dia **no horário de Brasília** (`src/domain/dates.ts`).
   - `insertion_date` → `timestamptz`.
   - `credentials (id, role text, user_id int, password_hash text, reset_token_digest text, reset_expires_at timestamptz)` com `UNIQUE (role, user_id)`. Ao remover o perfil, a senha sai junto.
   - Restrições `UNIQUE` e transações estão marcadas com `TODO(db)` no código (`grep -rn "TODO(db)" src`).
4. **Busca de vagas.** `ServiceUseCases.searchOpen` filtra em memória. No banco, vira `WHERE` (status, categoria, `duration BETWEEN`, data de publicação, `expires_at >= hoje`). A busca de texto sem acento vira `unaccent` + `ILIKE`, ou busca full-text em português (comentário `TODO(db)` no método).
5. **Fotos.** Não guarde bytes de imagem no PostgreSQL. Implemente `ImageStore` (`src/domain/images.ts`) sobre S3, Cloudflare R2 ou o disco do servidor e passe em `createContainer({ images })`. `urlFor(id)` passa a devolver a URL pública do bucket/CDN, e `idFromUrl(url)` faz o caminho inverso (é usado para apagar a foto antiga ao trocar). Os currículos fazem o mesmo com `DocumentStore` (`src/domain/documents.ts`), passado em `createContainer({ documents })`.
6. **Seed.** `src/data/seed.ts` só roda na memória. No banco, vire um script de seed ou migração.

Os testes continuam valendo: `npm run test:unit` usa o container com memória, e o `npm run smoke` pode rodar contra o banco para validar a troca.

---

## 🛣️ Rotas

Erros sempre no formato `{ "error": "mensagem" }` com o status correto (400 validação, 401 e-mail ou senha incorretos, 404 não encontrado, 409 conflito). POST/PATCH de sucesso devolvem `{ message, <entidade> }`; GET devolve o recurso ou a lista.

Status na API (em inglês): serviço `Pending | In Progress | Completed | Rejected | Cancelled`; candidatura `Pending | Accepted | Rejected`; pagamento `Completed`.

CPF: enviado com 11 dígitos, só números, com dígitos verificadores válidos. Em listas e respostas embutidas sai mascarado (`***.456.789-**`).

### Acesso (`/api/auth`)

Todo perfil tem senha (8 a 128 caracteres), enviada no cadastro em `password`. O mesmo e-mail pode ter um perfil de produtor e outro de trabalhador, cada um com a sua senha, por isso o login leva `role` (`farmer` ou `worker`). Ainda **não há token de sessão**: o login só confere a senha e devolve quem entrou; as demais rotas continuam sem proteção.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | `{ role, email, password }` → `{ message, user: { role, id } }`; 401 se e-mail ou senha não conferem (mesma mensagem nos dois casos) |
| POST | `/api/auth/password-reset` | Esqueci a senha, passo 1: `{ role, email }`. **Simulação**: o código iria por e-mail; por enquanto o token volta na resposta (`reset_token`). Vale 30 min e uma vez só; um pedido novo invalida o anterior. 404 se não houver cadastro com o e-mail |
| POST | `/api/auth/password-reset/confirm` | Passo 2: `{ token, password }` grava a nova senha; 400 se o token for inválido, já usado ou expirado |
| PATCH | `/api/farmers/:id/password` e `/api/workers/:id/password` | Troca com a conta aberta, sem código por e-mail: `{ current_password, new_password }`; 401 se a atual estiver errada, 400 se a nova for igual à atual. Cancela uma redefinição pendente |

### Produtor (`/api/farmers`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/farmers` | Lista produtores |
| POST | `/api/farmers` | Cadastra (`email`, `name`, `phone`, `cpf`, `password`); 409 se e-mail/CPF já existe entre produtores |
| GET | `/api/farmers/:id` | Perfil completo (`farms` = lista de IDs das fazendas) |
| PATCH | `/api/farmers/:id` | Edita `email`, `name`, `phone`; 400 se tentar alterar `id`/`cpf`/`password` |
| PATCH | `/api/farmers/:id/password` | Troca a senha (ver [Acesso](#acesso-apiauth)) |
| DELETE | `/api/farmers/:id` | Remove o produtor com fazendas, serviços, candidaturas e fotos; 409 se houver serviço `In Progress` |
| POST | `/api/farmers/:id/photo` | Envia/troca a foto de perfil, recortada em quadrado (corpo = bytes da imagem, `Content-Type: image/*`); devolve o produtor com `photo_url` |
| DELETE | `/api/farmers/:id/photo` | Remove a foto de perfil |
| GET | `/api/farmers/:id/farms` | Fazendas do produtor |
| POST | `/api/farmers/:id/farms` | Cadastra fazenda (`address`, `city`, `state`, `latitude`, `longitude` do ponto marcado no mapa) |
| PATCH | `/api/farmers/:id/farms/:farmId` | Edita `address`, `city`, `state`, `latitude`/`longitude` (sempre juntas) |
| DELETE | `/api/farmers/:id/farms/:farmId` | Arquiva a fazenda (`deleted_at`): some das listas, mas os serviços encerrados continuam com ela; 409 se houver serviço `Pending`/`In Progress` |
| POST | `/api/farmers/:id/farms/:farmId/photos` | Adiciona uma foto à fazenda (corpo = bytes da imagem); a primeira é a capa; 409 acima de 6 fotos |
| DELETE | `/api/farmers/:id/farms/:farmId/photos/:photoId` | Remove uma foto da fazenda |
| GET | `/api/farmers/:id/services?status=` | Serviços do produtor (com `farm` e `applications_pending`) |
| POST | `/api/farmers/services` | Publica serviço (`farmer_id`, `farm_id`, `name`, `category`, `duration` em horas, `price`, opcionais `description` e `expires_at` no formato `AAAA-MM-DD`) |
| GET | `/api/farmers/services/:id` | Serviço com a fazenda |
| PATCH | `/api/farmers/services/:id` | Edita `farm_id`, `name`, `category`, `duration`, `price`, `description`, `expires_at` (`null` tira o prazo; data futura renova uma vaga vencida); 409 se não estiver `Pending` |
| PATCH | `/api/farmers/services/:id/cancel` | Cancela (`Cancelled`) e recusa as candidaturas pendentes; 409 se não estiver `Pending` |
| GET | `/api/farmers/services/:id/applications` | Candidaturas com o trabalhador embutido |
| GET | `/api/farmers/services/:id/events` | Acompanha as candidaturas em tempo real (SSE, ver [abaixo](#atualização-em-tempo-real-sse)); 404 se o serviço não existe |
| PATCH | `/api/farmers/services/:id/analyze` | `{ application_id, action: "Accept" \| "Reject" }` |
| POST | `/api/farmers/services/:id/payment` | Libera pagamento (simulação) de serviço `In Progress`; cria `Payment` |

### Trabalhador (`/api/workers`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/workers` | Lista trabalhadores |
| POST | `/api/workers` | Cadastra (`email`, `name`, `phone`, `cpf`, `password`, opcionais `bio` (até 500), `experience`, `certificates`, `courses`) |
| GET | `/api/workers/:id` | Perfil completo |
| PATCH | `/api/workers/:id` | Edita `email`, `name`, `phone`, `bio`, `experience`, `certificates`, `courses`; 400 se tentar alterar `id`/`cpf`/`password` |
| PATCH | `/api/workers/:id/password` | Troca a senha (ver [Acesso](#acesso-apiauth)) |
| DELETE | `/api/workers/:id` | Remove o trabalhador, suas candidaturas, a foto e o currículo; 409 se tiver serviço `In Progress` |
| POST | `/api/workers/:id/photo` | Envia/troca a foto de perfil, recortada em quadrado (corpo = bytes da imagem) |
| DELETE | `/api/workers/:id/photo` | Remove a foto de perfil |
| POST | `/api/workers/:id/resume` | Envia/troca o currículo (corpo = bytes do PDF, `Content-Type: application/pdf`, até 5 MB); devolve o trabalhador com `resume_url` |
| DELETE | `/api/workers/:id/resume` | Remove o currículo |
| GET | `/api/workers/:id/applications` | Candidaturas com o serviço embutido (com o ponto da fazenda no mapa quando a candidatura foi aceita) |
| GET | `/api/workers/:id/events` | Acompanha o status das candidaturas em tempo real (SSE, ver [abaixo](#atualização-em-tempo-real-sse)); 404 se o trabalhador não existe |
| GET | `/api/workers/:id/services` | Serviços atribuídos ao trabalhador (com `farm.latitude`/`farm.longitude`) |
| GET | `/api/workers/services` | Vagas abertas e dentro do prazo (com cidade/UF e fotos da fazenda). Filtros combináveis: `q` (palavras no nome, descrição, categoria ou cidade, sem diferenciar acentos), `category`, `min_hours`/`max_hours`, `from`/`to` (dia de publicação, `AAAA-MM-DD`), `sort` (`recent`, `price_desc`, `price_asc`, `duration_asc`, `duration_desc`); 400 se algum filtro for inválido |
| GET | `/api/workers/services/:id?worker_id=` | Detalhe da vaga. Com `worker_id` do trabalhador aceito no serviço, inclui `farm.latitude`/`farm.longitude` |
| POST | `/api/workers/services/:id/apply` | `{ worker_id }`; 409 se a vaga não está aberta, se o prazo terminou ou se já houve candidatura |
| PATCH | `/api/workers/services/:id/withdraw` | `{ worker_id }`; desiste e volta uma etapa: candidatura `Pending` é removida; se já aceito, o serviço volta a `Pending` e as candidaturas recusadas pelo aceite voltam a `Pending`; 409 se recusada ou serviço encerrado |

### Outros
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/categories` | Lista fixa de categorias |
| GET | `/api/config/maps` | Chave e Map ID do Google Maps (`.env`); 403 se o `Origin` não for do frontend, 503 se a chave não estiver configurada |
| GET | `/api/images/:id` | Serve uma foto (WebP, cache imutável de 1 ano) |
| GET | `/api/documents/:id` | Serve um currículo (PDF, cache imutável de 1 ano) |

**Localização da fazenda:** o produtor marca o ponto no mapa (`latitude`/`longitude`, obrigatórias no cadastro; fazendas antigas podem ter `null`). O trabalhador só recebe as coordenadas nos serviços em que foi aceito; nas vagas abertas vê apenas cidade/UF.

### Atualização em tempo real (SSE)

As telas de candidatos do serviço (produtor) e de candidaturas (trabalhador) se atualizam sozinhas por **Server-Sent Events**: o frontend abre `GET .../events` com `EventSource`, a resposta (`text/event-stream`) fica aberta e chega `event: applications` a cada mudança. O aviso não traz dados; a tela busca a lista de novo pela rota de sempre. A cada 25 s vai um `: ping` para a conexão não ser cortada por inatividade, e o `EventSource` reconecta sozinho se ela cair.

Os casos de uso publicam os avisos (`ChangeFeed`, `src/domain/changes.ts`) depois de cada mudança: candidatura, desistência, aceite/recusa (inclusive as recusadas pelo aceite e as que voltam a `Pending`), edição, cancelamento e pagamento do serviço, e remoção de produtor ou trabalhador. A implementação em memória (`InMemoryChangeFeed`) só vale para **um processo**; com várias instâncias da API, troque por algo compartilhado (LISTEN/NOTIFY do PostgreSQL ou Redis pub/sub) em `createContainer({ changes })`.

**Prazo das vagas (`expires_at`):** dia do calendário. A vaga aceita candidaturas até o fim desse dia no horário de Brasília. Depois disso continua `Pending` para o produtor, mas some da busca e recusa candidaturas (409) até o produtor renovar a data. Não dá para publicar ou editar com data no passado (400).

---

## 🛠️ Próximos passos
- [ ] Banco de dados (ver [Armazenamento](#-armazenamento-temporário-e-migração-para-postgresql) e os `TODO(db)` no código: IDs, unicidade, transações no aceite/pagamento).
- [ ] Guardar as fotos num bucket (S3/R2) em vez da memória.
- [ ] Enviar o código de redefinição de senha por e-mail (e parar de devolvê-lo em `POST /api/auth/password-reset`; ver `TODO(email)`).
- [ ] Token de sessão no login e proteção das rotas (hoje o login só confere a senha).
- [ ] Trilhas de qualificação, registro de horas e relatórios em PDF.
