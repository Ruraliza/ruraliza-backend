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
npm test                 # typecheck + lint + unitários + integração + e2e
npm run test:unit        # unitários colocados (src/**/*.spec.ts): cada caso de uso com repositórios em memória
npm run test:integration # fluxos entre módulos pelo container, sem HTTP (tests/integration) e o seed (tests/setup)
npm run test:e2e         # HTTP de verdade: percorre o fluxo completo e os casos de erro (tests/e2e)
npm run check:contracts  # confere que o contrato bate com os models do frontend (../ruraliza-frontend)
```

Ao subir, o servidor carrega **dados de teste**: 1 produtor (com 2 fazendas), 1 trabalhador, 1 conta com os dois perfis e 7 serviços `Pending`, um por categoria, publicados nos últimos 12 dias e com todos os casos de prazo (sem prazo, vence em alguns dias, vence hoje e o serviço 7 já vencido, que só o produtor vê). As datas são relativas ao dia em que o servidor sobe.

### Usuários de teste

Criados pelo seed (`src/seed.ts`) a cada vez que o servidor sobe. Cada conta entra só com e-mail e senha; quem tem os dois perfis alterna entre os painéis pelo menu (acima de **Sair**).

| Conta | Perfis (ID) | Nome | E-mail | Senha | CPF | Dados |
|---|---|---|---|---|---|---|
| 1 | Produtor 1 | João Produtor | `produtor@exemplo.com` | `ruraliza123` | `52998224725` | Fazendas 1 (São José, Três Rios/RJ) e 2 (Boa Vista, Paraíba do Sul/RJ); serviços 1 a 7 |
| 2 | Trabalhador 1 | Maria Trabalhadora | `trabalhador@exemplo.com` | `ruraliza123` | `11144477735` | Perfil completo (apresentação, experiência, certificado e curso), sem foto e sem currículo; nenhuma candidatura |
| 3 | Produtor 2 e trabalhador 2 | Carlos Produtor e Trabalhador | `ambos@exemplo.com` | `ruraliza123` | `39053344705` | Abre no painel de produtor; sem fazendas nem serviços |

Se você trocar a senha de um deles (pelo perfil ou por "Esqueci minha senha"), ela volta a ser `ruraliza123` quando o servidor reinicia, porque os dados ficam em memória.

**Equipe (usuários de sistema):** `admin@exemplo.com`, senha `ruraliza123`, cargo `admin`. Entra pela tela `/sistema/entrar` do frontend (ou `POST /api/auth/system/login`), não pelo login do app. Fora do seed, o primeiro administrador vem de `ADMIN_EMAIL`/`ADMIN_PASSWORD` no `.env`.

### Configuração (`.env`)

As variáveis ficam no `.env` (fora do git). O `.env.example` traz cada uma com instruções:

| Variável | Para quê |
|---|---|
| `PORT` | Porta do servidor (padrão 3000) |
| `CORS_ORIGINS` | Origens (separadas por vírgula) aceitas pelo CORS e por `GET /api/config/maps`. Sem ela, só `https://ruraliza.github.io`. Em `npm run dev` o CORS aceita qualquer origem, mas a rota do mapa continua restrita. No `.env` local use `http://localhost:4200`; no Render, não defina |
| `GOOGLE_MAPS_API_KEY` | Chave do Google Maps Platform (Maps JavaScript API + Geocoding API + Maps Embed API). Entregue ao frontend por `GET /api/config/maps`, então **restrinja por HTTP referrer** no Google Cloud. Sem ela, essa rota responde 503 e o mapa fica indisponível |
| `GOOGLE_MAPS_MAP_ID` | Map ID para o alfinete arrastável (padrão `DEMO_MAP_ID`, só para desenvolvimento) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Chaves das notificações push (gere com `npx web-push generate-vapid-keys`). Sem elas, `GET /api/config/push` responde 503 e nada é enviado |
| `VAPID_SUBJECT` | Contato do responsável pelo envio (`mailto:` ou `https:`), exigido pelos serviços de push |

Em produção (Render), cadastre as mesmas variáveis no painel do serviço.

---

## 📖 Documentação (Swagger / OpenAPI)

Com o servidor rodando:

- **Swagger UI**: http://localhost:3000/api/docs (dá para testar as rotas pelo "Try it out")
- **OpenAPI 3.0 (JSON)**: http://localhost:3000/api/docs/openapi.json

A documentação é gerada do mesmo lugar em que as rotas são declaradas (`src/modules/*/presentation/*.routes.ts`, com `route(método, caminho, handler, operation({...}))`), então não existe rota sem documentação. Cada módulo declara os seus schemas (`presentation/*.schemas.ts`) e `src/docs/schemas.ts` registra todos.

O `npm run test:e2e` confere **toda resposta** contra o documento: a rota e o status precisam estar documentados e o corpo precisa bater com o schema (campos a mais também falham). Ao mudar uma resposta, atualize o schema, senão o e2e acusa.

---

## 🔒 Tipagem

- **Compilador estrito** (`tsconfig.json`): `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, entre outros.
- **Sem `any`**: o ESLint com informação de tipos (`npm run lint`) barra `any` explícito e também valores `any` vindos de bibliotecas (`no-unsafe-*`).
- **Entrada validada em tempo de execução**: `req.body` e `req.query` chegam como `unknown`; cada rota valida e converte para o tipo de entrada do contrato (`src/shared/infra/http/body.ts`, parsers por módulo). Os handlers usam `Handler<Resposta, Params>` (`src/shared/infra/http/types.ts`), então a resposta de cada rota é checada contra o contrato.
- **Contrato com o frontend** (`src/contracts`, que reúne também os `*.contract.ts` dos módulos): entidades, entradas e respostas da API, com os mesmos nomes e formatos de `ruraliza-frontend/src/models`. O `npm run check:contracts` falha se algum tipo divergir em qualquer sentido. Ao mudar um tipo, altere os dois lados e rode o check.

---

## 📁 Estrutura

```text
app.ts                      # createApi(container): middlewares, docs, rotas, erros; e o start do servidor
contract-check/             # Verificação de paridade de tipos com o frontend
tests/
  integration/              # Fluxos entre módulos pelo container (sem HTTP); support.ts tem os atalhos
  setup/                    # O seed de demonstração
  e2e/                      # smoke.e2e.ts (HTTP de verdade) + support/openapi-check.ts; http/ com requisições manuais
src/
  container.ts              # Raiz de composição: escolhe as implementações e monta os casos de uso de cada módulo
  repositories.ts           # Todos os repositórios (Repositories) e a versão em memória
  routes.ts                 # Os grupos de rotas de cada módulo, na ordem de cada prefixo
  seed.ts                   # Seed de demonstração
  docs/                     # Registro de todos os schemas OpenAPI e montagem do documento
  contracts/                # Barrel do contrato da API (reexporta os *.contract.ts) para o check:contracts
  modules/                  # Uma fatia vertical por contexto de negócio:
                            #   accounts, auth, farmers, workers, farms, services, hiring, media,
                            #   notifications, system-users, admin, platform
    <módulo>/
      index.ts              #   API pública: o único arquivo que outro módulo enxerga (#modules/<módulo>)
      <módulo>.module.ts    #   Monta os casos de uso (container) e as rotas (src/routes.ts)
      <nome>.contract.ts    #   Contrato da API do módulo
      domain/               #   Porta do repositório e regras puras
      application/          #   Um caso de uso por arquivo (*.usecase.ts), com o teste ao lado (*.spec.ts)
      infra/                #   Implementações (repositório em memória; Web Push em notifications)
      presentation/         #   Controller, rotas, parsers do corpo e schemas OpenAPI
      testing/              #   Fixtures dos testes (fora do build)
  shared/
    contracts/              # ApiError e MessageResponse
    domain/                 # Result, Clock, datas, Repository<T, K> e portas transversais (imagens, documentos, senhas, tokens, avisos)
    infra/http/             # route(), contrato de acesso (Access), tipos dos handlers, corpo, erros, SSE
    infra/docs/             # Kit do OpenAPI: helpers de schema, operation(), schemas genéricos
    infra/                  # crypto (scrypt, HMAC), images (Sharp + store), documents, memory
    testing/                # unwrap(), fixedClock() e dublês que gravam avisos e pushes (fora do build)
    utils/                  # Validações (e-mail, CPF, senha) e perfil público (CPF mascarado)
    config.ts               # Variáveis de ambiente
```

### Camadas e módulos

Dentro de um módulo: `presentation → application → domain ← infra`. Os casos de uso dependem só das portas (ex.: `FarmRepository`), nunca da implementação; para trocar a persistência (ex.: PostgreSQL), escreva repositórios que cumpram essas portas e passe-os em `createContainer({ repos })`. Os repositórios devolvem cópias (como um banco): alterar uma entidade só vale depois de `update`.

Imports: dentro do módulo, relativos; entre módulos, só `#modules/<módulo>` (o alias resolve apenas o `index.ts`, então import profundo em outro módulo não compila); infraestrutura comum, `#shared/...`. Os aliases ficam em `"imports"` do `package.json`: com a condição `development` (`tsx --conditions=development`, usada por todos os scripts, e o type-check) apontam para os `.ts`; o `node dist/` usa os `.js` compilados.

Regras de fronteira:

- `src/shared` não importa módulos. A única exceção é o tipo `Principal` (quem está logado: uma `Account` ou um usuário de sistema), que o HTTP compartilhado carrega em `res.locals`.
- Alguns módulos se importam nos dois sentidos (ex.: `farms` ↔ `services`, `services` ↔ `hiring`). Por isso, valor de outro módulo só é lido dentro de funções, nunca no carregamento do arquivo (nada de `const X = [OUTRO_MODULO.Y]` no topo).
- Quando um módulo precisaria chamar outro que já depende dele, ele declara uma porta e o container liga (ex.: `ProfileFactory` em `accounts`, implementada com os casos de uso de `farmers` e `workers`).
- Cada schema OpenAPI fica no módulo dono; um módulo só cita os nomes que declara ou importa (`operation<NomesDoMódulo>`), e `src/docs/schemas.ts` confere que todos existem.

---

## 💾 Armazenamento temporário e migração para PostgreSQL

### Como está hoje (sem banco)

| O quê | Onde fica | Implementação |
|---|---|---|
| Produtores, trabalhadores, fazendas, serviços, candidaturas, pagamentos | Array em memória, um por entidade, com id sequencial | `InMemoryRepository` (`src/shared/infra/memory/`) |
| Fotos (perfil do produtor, perfil do trabalhador, fazendas) | `Map` em memória de id para bytes WebP | `InMemoryImageStore` (`src/shared/infra/images/in-memory-image-store.ts`) |
| Tratamento das fotos | Processado no upload, não é guardado | `SharpImageProcessor` (`src/shared/infra/images/`) |
| Senhas (hash) e pedidos de redefinição | Array em memória, separado dos perfis | `InMemoryRepository` de `Account` (`src/modules/accounts/domain/account.ts`) |
| Currículos dos trabalhadores (PDF) | `Map` em memória de id para bytes do PDF | `InMemoryDocumentStore` (`src/shared/infra/documents/in-memory-document-store.ts`) |

- Os repositórios já são **assíncronos** e devolvem **cópias** (`structuredClone`). Eles se comportam como um banco: o resto do código não sabe que é memória.
- As entidades guardam **só a URL** da foto (`photo_url`, `farm.photos[].url`), nunca os bytes. Hoje a URL é `/api/images/<uuid>.webp`, servida por `GET /api/images/:id` com cache imutável.
- Toda foto enviada passa pelo `SharpImageProcessor` antes de ser guardada: corrige a rotação do celular, reduz para **no máximo 1000 px no maior lado** (sem ampliar fotos pequenas), converte para **WebP (qualidade 78)** e remove os metadados (EXIF/GPS). Fotos de perfil saem sempre **quadradas** (até 1000×1000 px): o app envia a foto já recortada pelo usuário e, se chegar outra proporção, o servidor recorta o quadrado central. Arquivos que não são imagem são recusados com 400. Uploads acima de 10 MB são recusados com 413.
- O currículo do trabalhador segue o mesmo esquema, sem processamento: o PDF é guardado como chegou, depois de conferir a assinatura `%PDF-` (outro arquivo dá 400; acima de 5 MB, 413). O trabalhador guarda só `resume_url` (`/api/documents/<uuid>.pdf`), servida por `GET /api/documents/:id`.
- A senha **não fica no perfil**: vai para o repositório `accounts` (`email`, `password_hash`, `farmer_id`, `worker_id`, `last_role`), então nunca sai numa resposta. Uma conta por e-mail e por CPF, com até um perfil de cada tipo e a mesma senha para os dois. O hash é **scrypt** com sal aleatório (`src/shared/infra/crypto/node-crypto.ts`). O pedido de "esqueci a senha" guarda só o SHA-256 do token, com validade de 30 minutos.
- A escolha de tudo isso está num lugar só: `src/container.ts` (`createContainer`).

### Como ligar o PostgreSQL

1. **Repositórios.** Em cada módulo, crie `infra/pg-<entidade>.repository.ts` (com `pg` ou Sequelize, que já estão nas dependências) ao lado do de memória, implementando a porta do módulo (ex.: `FarmRepository` em `src/modules/farms/domain/`, um `Repository<T, K>` de `src/shared/domain/repository.ts`: `findById`, `find(criteria)`, `create`, `update`, `delete`). `find(criteria)` é só igualdade de campos (`WHERE campo = $1 AND ...`). Monte um `createPostgresRepositories(conexão)` que devolva o objeto `Repositories`.
2. **Container.** Em `app.ts` (no bloco que sobe o servidor), troque `createContainer()` por `createContainer({ repos: createPostgresRepositories(conexão) })`, montando o `Repositories` de `src/repositories.ts` com os repositórios de cada módulo. Rotas, controllers e regras não mudam.
3. **Tabelas.** Os campos são exatamente os de `src/contracts/` (e dos `*.contract.ts` dos módulos). Pontos de atenção:
   - `farm.photos` → tabela `farm_photos (id text, farm_id int references farms, url text, position int)`, ou coluna `jsonb`.
   - `expires_at` → `date` (dia do calendário, sem hora). A vaga vale até o fim desse dia **no horário de Brasília** (`src/shared/domain/dates.ts`).
   - `insertion_date` → `timestamptz`.
   - `accounts (id, email text UNIQUE, password_hash text, reset_token_digest text, reset_expires_at timestamptz, farmer_id int UNIQUE references farmers ON DELETE SET NULL, worker_id int UNIQUE references workers ON DELETE SET NULL, last_role text)`. Ao remover um perfil, ele sai da conta; a conta some junto com o último perfil.
   - `system_users (id, email text UNIQUE, name text, role text CHECK (role IN ('admin','tutor')), password_hash text, insertion_date timestamptz)`: a equipe, sem ligação com `accounts`.
   - Restrições `UNIQUE` e transações estão marcadas com `TODO(db)` no código (`grep -rn "TODO(db)" src`).
4. **Busca de vagas.** `SearchOpenServicesUseCase` (`src/modules/services/application/`) filtra em memória. No banco, vira `WHERE` (status, categoria, `duration BETWEEN`, data de publicação, `expires_at >= hoje`). A busca de texto sem acento vira `unaccent` + `ILIKE`, ou busca full-text em português (comentário `TODO(db)` no caso de uso).
5. **Fotos.** Não guarde bytes de imagem no PostgreSQL. Implemente `ImageStore` (`src/shared/domain/images.ts`) sobre S3, Cloudflare R2 ou o disco do servidor e passe em `createContainer({ images })`. `urlFor(id)` passa a devolver a URL pública do bucket/CDN, e `idFromUrl(url)` faz o caminho inverso (é usado para apagar a foto antiga ao trocar). Os currículos fazem o mesmo com `DocumentStore` (`src/shared/domain/documents.ts`), passado em `createContainer({ documents })`.
6. **Seed.** `src/seed.ts` só roda na memória. No banco, vire um script de seed ou migração.

Os testes continuam valendo: `npm run test:unit` e `npm run test:integration` usam repositórios em memória, e o `npm run test:e2e` pode rodar contra o banco para validar a troca.

---

## 🛣️ Rotas

Erros sempre no formato `{ "error": "mensagem" }` com o status correto (400 validação, 401 sem sessão válida ou e-mail/senha incorretos, 403 sem permissão, 404 não encontrado, 409 conflito). POST/PATCH de sucesso devolvem `{ message, <entidade> }`; GET devolve o recurso ou a lista.

Status na API (em inglês): serviço `Pending | In Progress | Completed | Rejected | Cancelled`; candidatura `Pending | Accepted | Rejected`; pagamento `Completed`.

CPF: enviado com 11 dígitos, só números, com dígitos verificadores válidos. Em listas e respostas embutidas sai mascarado (`***.456.789-**`).

### Acesso (`/api/auth`)

Uma **conta por pessoa** (e-mail e CPF únicos), com senha de 8 a 128 caracteres enviada no cadastro em `password`. A conta começa com o perfil escolhido no cadastro (`POST /api/farmers` ou `POST /api/workers`, que já devolvem a sessão em `user`) e pode ganhar o outro perfil depois (`/api/accounts`). A mesma senha vale para os dois. A sessão (`user`) é `{ account_id, role, id, profiles: { farmer, worker } }`: `role`/`id` são o painel aberto.

**Token de sessão.** Login, redefinição de senha e cadastro devolvem `token` (assinado com HMAC-SHA256 e `AUTH_TOKEN_SECRET`, válido por 12 horas). Toda rota que não é pública exige `Authorization: Bearer <token>` e confere o dono: uma conta só mexe nos próprios perfis, fazendas, serviços e candidaturas (`farmer_id`/`worker_id` no corpo ou na query precisam ser os dela). Sem token ou com token inválido/vencido: **401**; token de outra pessoa ou de outro tipo de usuário: **403**. O token diz só quem entrou; conta e perfis são relidos a cada requisição, então uma conta removida perde o acesso na hora. As regras ficam em `src/modules/auth/presentation/access.ts` e cada rota declara a sua em `route()` (a documentação mostra o cadeado e quem pode).

Rotas públicas: login e redefinição de senha, cadastro (`POST /api/farmers` e `POST /api/workers`), categorias, configuração, health, imagens e currículos (`/api/images/:id` e `/api/documents/:id`, lidos por `<img>` e links, com ids aleatórios). Nas duas rotas SSE o token também vale em `?access_token=`, porque o `EventSource` do navegador não envia cabeçalhos.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` → `{ message, user, token }`, abrindo o último painel usado; 401 se e-mail ou senha não conferem (mesma mensagem nos dois casos) |
| POST | `/api/auth/password-reset` | Esqueci a senha, passo 1: `{ email }`. **Simulação**: o código iria por e-mail; por enquanto o token volta na resposta (`reset_token`). Vale 30 min e uma vez só; um pedido novo invalida o anterior. 404 se não houver conta com o e-mail |
| POST | `/api/auth/password-reset/confirm` | Passo 2: `{ token, password }` grava a nova senha; 400 se o token for inválido, já usado ou expirado |
| PATCH | `/api/farmers/:id/password` e `/api/workers/:id/password` | Troca com a conta aberta, sem código por e-mail: `{ current_password, new_password }`; 401 se a atual estiver errada, 400 se a nova for igual à atual. Cancela uma redefinição pendente |
| POST | `/api/auth/system/login` | Login da equipe (usuários de sistema): `{ email, password }` → `{ message, user, token }`. Separado das contas do app |
| GET | `/api/auth/system/me` | O usuário de sistema do token, com o cargo atual |
| PATCH | `/api/auth/system/me` | O usuário de sistema edita o próprio perfil: `name`, `email` (o cargo só um administrador muda) |

### Conta (`/api/accounts`)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/accounts/:id` | Sessão da conta (`user`), no mesmo formato do login |
| POST | `/api/accounts/:id/profiles` | Cria o outro perfil na conta: `{ role, name, phone, cpf }` (+ `bio`, `certificates`, `courses`, `experience` para trabalhador). E-mail e senha são os da conta. Já abre o painel novo. 409 se a conta já tem esse perfil ou se o CPF é de outra conta |
| PATCH | `/api/accounts/:id/active-role` | `{ role }`: troca o painel aberto (e o que abre no próximo login); 404 se a conta não tem esse perfil |
| POST | `/api/accounts/:id/push-subscriptions` | `{ endpoint, keys: { p256dh, auth } }` (o `PushSubscription.toJSON()` do navegador): ativa as notificações push neste navegador, para os dois perfis da conta. Reenviar a mesma inscrição não duplica |
| DELETE | `/api/accounts/:id/push-subscriptions` | `{ endpoint }`: desativa as notificações neste navegador |

Quem tem os dois perfis **não pode se candidatar a um serviço que publicou** como produtor (`POST /api/workers/services/:id/apply` responde 409).

### Produtor (`/api/farmers`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/farmers` | Lista produtores (só administração) |
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
| GET | `/api/workers` | Lista trabalhadores (só administração) |
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

### Administração (`/api/admin`)

Usuários de sistema são a equipe do Ruraliza, separados das contas do app e **sem cadastro público**. Cada um tem um cargo (`role`): `admin` gerencia as contas do app e a equipe; `tutor` vai gerenciar as trilhas de estudo (ainda sem rotas). As rotas pedem uma permissão, não um cargo; o mapa cargo → permissões fica em `src/modules/system-users/domain/system-user.ts`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/admin/users` | Contas do app com os perfis de produtor e trabalhador (CPF mascarado), as mais novas primeiro |
| GET | `/api/admin/users/:id` | Uma conta (`account_id`) com os perfis completos |
| DELETE | `/api/admin/users/:id` | Remove a conta e os dois perfis (com fazendas, serviços, candidaturas, fotos, currículo e inscrições de push); 409 sem remover nada se algum perfil tiver serviço `In Progress` |
| PATCH | `/api/admin/farmers/:id` e `/api/admin/workers/:id` | Edita o perfil, com as mesmas regras do próprio usuário |
| DELETE | `/api/admin/farmers/:id` e `/api/admin/workers/:id` | Remove só esse perfil; a conta continua se tiver o outro |
| DELETE | `/api/admin/farmers/:id/photo` e `/api/admin/workers/:id/photo` | Remove a foto de perfil (ex.: imagem imprópria); a imagem é apagada e a pessoa pode enviar outra |
| GET | `/api/admin/system-users` | A equipe (administradores e tutores) |
| POST | `/api/admin/system-users` | Cadastra usuário de sistema: `{ email, name, role: "admin" \| "tutor", password }`; 409 se o e-mail já existe na equipe |
| GET | `/api/admin/system-users/:id` | Um usuário de sistema |
| PATCH | `/api/admin/system-users/:id` | Edita `name`, `email` e `role` de um membro da equipe; 409 se o e-mail já existe ou se o administrador tentar mudar o próprio cargo (a equipe nunca fica sem administrador) |

### Outros
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/categories` | Lista fixa de categorias |
| GET | `/api/config/push` | Chave pública VAPID das notificações push; 503 se as chaves não estiverem no `.env` |
| GET | `/api/config/maps` | Chave e Map ID do Google Maps (`.env`); 403 se o `Origin` não for do frontend, 503 se a chave não estiver configurada |
| GET | `/api/images/:id` | Serve uma foto (WebP, cache imutável de 1 ano) |
| GET | `/api/documents/:id` | Serve um currículo (PDF, cache imutável de 1 ano) |

**Localização da fazenda:** o produtor marca o ponto no mapa (`latitude`/`longitude`, obrigatórias no cadastro; fazendas antigas podem ter `null`). O trabalhador só recebe as coordenadas nos serviços em que foi aceito; nas vagas abertas vê apenas cidade/UF.

### Atualização em tempo real (SSE)

As telas de candidatos do serviço (produtor) e de candidaturas (trabalhador) se atualizam sozinhas por **Server-Sent Events**: o frontend abre `GET .../events` com `EventSource`, a resposta (`text/event-stream`) fica aberta e chega `event: applications` a cada mudança. O aviso não traz dados; a tela busca a lista de novo pela rota de sempre. A cada 25 s vai um `: ping` para a conexão não ser cortada por inatividade, e o `EventSource` reconecta sozinho se ela cair.

Os casos de uso publicam os avisos (`ChangeFeed`, `src/shared/domain/changes.ts`) depois de cada mudança: candidatura, desistência, aceite/recusa (inclusive as recusadas pelo aceite e as que voltam a `Pending`), edição, cancelamento e pagamento do serviço, e remoção de produtor ou trabalhador. A implementação em memória (`InMemoryChangeFeed`) só vale para **um processo**; com várias instâncias da API, troque por algo compartilhado (LISTEN/NOTIFY do PostgreSQL ou Redis pub/sub) em `createContainer({ changes })`.

### Notificações push

Com o app fechado, quem precisa agir recebe uma notificação (**Web Push**, chaves VAPID do `.env`): o produtor quando alguém se candidata ou desiste; o trabalhador quando é aceito, recusado (inclusive pelo aceite de outro), quando o serviço é cancelado e quando o pagamento é liberado. A mensagem segue o formato do service worker do Angular (`notification.data.onActionClick`), e o clique abre o app na tela certa.

O envio (`PushDispatcher`, `src/modules/notifications/infra/web-push-sender.ts`) roda em segundo plano: falha no serviço de push só vai para o log, nunca para a resposta. Inscrições que o navegador revogou (404/410) são apagadas no primeiro envio. Como o resto dos dados, as inscrições ficam em memória; o frontend reenvia a dele a cada abertura do app.

**Prazo das vagas (`expires_at`):** dia do calendário. A vaga aceita candidaturas até o fim desse dia no horário de Brasília. Depois disso continua `Pending` para o produtor, mas some da busca e recusa candidaturas (409) até o produtor renovar a data. Não dá para publicar ou editar com data no passado (400).

---

## 🛠️ Próximos passos
- [ ] Banco de dados (ver [Armazenamento](#-armazenamento-temporário-e-migração-para-postgresql) e os `TODO(db)` no código: IDs, unicidade, transações no aceite/pagamento).
- [ ] Guardar as fotos num bucket (S3/R2) em vez da memória.
- [ ] Enviar o código de redefinição de senha por e-mail (e parar de devolvê-lo em `POST /api/auth/password-reset`; ver `TODO(email)`).
- [ ] Encerrar as sessões abertas ao trocar a senha (hoje o token vale até vencer).
- [ ] Rotas do tutor para cadastrar e editar trilhas de estudo (permissão `tracks:manage`).
- [ ] Trilhas de qualificação, registro de horas e relatórios em PDF.
