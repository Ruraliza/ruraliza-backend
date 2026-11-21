# 🌾 Ruraliza - API Backend

O projeto **AgTech Ruraliza** conecta produtores rurais a trabalhadores, prestadores e estudantes, facilitando a prestação de serviços operacionais nas fazendas.

API em **Node.js + Express 5 + TypeScript**, padrão **MVC**. Os dados e os arquivos ficam em **PostgreSQL** quando `DATABASE_URL` está definida; sem ela, ficam **em memória** e somem quando o servidor reinicia. Veja [Armazenamento](#-armazenamento).

---

## 🗺️ Documentos do projeto

[Produto e escopo](PRODUCT.md) · [Funcionalidades](docs/features.md) · [Arquitetura](docs/architecture.md) · [Convenções da API](docs/design.md) · [Primeira execução](docs/onboarding.md) · [Qualidade e revisão](docs/quality.md) · [Ferramentas de agente](docs/setup.md) · [Instruções para agentes de IA](AGENTS.md)

---

## 🚀 Como executar

Pré-requisito: [Node.js](https://nodejs.org/) 20.19+, 22.13+ ou 24 (o mínimo do ESLint 10; desenvolvido no 24).

```bash
cp .env.example .env     # configuração local (porta, chave do Google Maps)
npm install
npm run dev              # sobe em http://localhost:3000/api (tsx) e reinicia ao salvar
npm start                # compila para dist/ e sobe o JavaScript gerado
npm test                 # typecheck + lint + autoteste das regras + unitários + integração + e2e
npm run test:unit        # unitários colocados (src/**/*.spec.ts): cada caso de uso com repositórios em memória
npm run test:integration # fluxos entre módulos pelo container, sem HTTP (tests/integration) e o seed (tests/setup)
npm run test:e2e         # HTTP de verdade: percorre o fluxo completo e os casos de erro (tests/e2e)
npm run test:postgres    # os mesmos fluxos e o e2e sobre o PostgreSQL (precisa de TEST_DATABASE_URL; ver Armazenamento)
npm run check:contracts  # confere que o contrato bate com os models do frontend (../ruraliza-frontend)
```

O servidor carrega **dados de teste** ao subir, também em produção (`npm start`), enquanto o app é só de demonstração e teste: as contas abaixo usam a senha pública (a tela de entrar do app só as mostra no build de desenvolvimento). `SEED_DEMO=false` desliga o seed fora do `--dev`; sem ele, a equipe entra pelo administrador de `ADMIN_EMAIL`/`ADMIN_PASSWORD` ou, sem eles, pelo administrador padrão `admin@ruraliza.app`, com a senha sorteada que aparece no log do servidor a cada subida. Desligue antes de haver dados de verdade.

Os dados de teste: 1 produtor (com 2 fazendas), 2 trabalhadores, 1 conta com os dois perfis e 7 serviços `Pending`, um por categoria, publicados nos últimos 12 dias e com todos os casos de prazo (sem prazo, vence em alguns dias, vence hoje e o serviço 7 já vencido, que só o produtor vê). As datas são relativas ao dia em que o seed roda: a cada subida em memória; no PostgreSQL, só na primeira subida de cada banco.

Depois das vagas vem um **histórico** para as [avaliações](#avaliações) e a [conversa](#conversas) (`src/seed-history.ts`): os serviços 8 a 10 já concluídos e avaliados pelos dois lados (as duas fazendas e a Maria têm nota; o Pedro tem uma nota mediana), o 11 concluído há 3 dias que a Maria já avaliou e o produtor ainda não (a nota dela fica escondida), o 12 concluído ontem sem avaliações e com a conversa ainda aberta, e o 13 em andamento com a Maria, com conversa (a última mensagem do produtor ainda não lida por ela). A vaga 1 tem dois candidatos: o Pedro (com nota) e o Carlos (sem avaliações). A **central de notificações** do João e da Maria já vem com os avisos que essa história geraria (candidaturas, avaliação, mensagens, pagamento), alguns lidos e outros não.

### Usuários de teste

Criados pelo seed (`src/seed.ts`) a cada vez que o servidor sobe em memória, ou uma vez por banco no PostgreSQL (menos com `SEED_DEMO=false`). Cada conta entra só com e-mail e senha; quem tem os dois perfis alterna entre os painéis pelo menu (acima de **Sair**).

| Conta | Perfis (ID) | Nome | E-mail | Senha | CPF | Dados |
|---|---|---|---|---|---|---|
| 1 | Produtor 1 | João Produtor | `produtor@exemplo.com` | `ruraliza123` | `52998224725` | Fazendas 1 (São José, Três Rios/RJ) e 2 (Boa Vista, Paraíba do Sul/RJ); serviços 1 a 7 |
| 2 | Trabalhador 1 | Maria Trabalhadora | `trabalhador@exemplo.com` | `ruraliza123` | `11144477735` | Perfil completo (apresentação, experiência, certificado e curso), sem foto e sem currículo; serviços concluídos com nota 4,7, uma avaliação pendente e a conversa do serviço 13; trilha 1 pela metade |
| 3 | Produtor 2 e trabalhador 2 | Carlos Produtor e Trabalhador | `ambos@exemplo.com` | `ruraliza123` | `39053344705` | Abre no painel de produtor; sem fazendas nem serviços; como trabalhador, candidato à vaga 1 (sem avaliações) |
| 4 | Trabalhador 3 | Pedro Diarista | `pedro@exemplo.com` | `ruraliza123` | `71428793860` | Um serviço concluído (nota 3,7) e candidato à vaga 1: bom para testar o aceite, a conversa e a avaliação |

Se você trocar a senha de um deles (pelo perfil ou por "Esqueci minha senha", que no `npm run dev` mostra o código no terminal da API), ela volta a ser `ruraliza123` quando o servidor reinicia em memória. Com PostgreSQL, a senha nova fica.

**Equipe (usuários de sistema):** `admin@exemplo.com` (cargo `admin`) e `tutor@exemplo.com` (cargo `tutor`, dono das trilhas 1 e 2, publicadas, e 3, em rascunho), senha `ruraliza123`. Entra pela tela `/sistema/entrar` do frontend (ou `POST /api/auth/system/login`), não pelo login do app. Com `SEED_DEMO=false`, o primeiro administrador vem de `ADMIN_EMAIL`/`ADMIN_PASSWORD` no `.env` (ou nas variáveis do Render); sem eles, é `admin@ruraliza.app`, com a senha sorteada que sai no log (com PostgreSQL, só no log da subida que o criou).

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
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `SUPABASE_BUCKET` | Bucket privado do Supabase Storage para fotos e currículos, no lugar do banco. As três juntas, com `DATABASE_URL`. Veja [Armazenamento](#-armazenamento) |

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
- **Contrato com o frontend** (`src/contracts`, que reúne também os `*.contract.ts` dos módulos): entidades, entradas e respostas da API, com os mesmos nomes e formatos de `ruraliza-frontend/src/app/core/models`. O `npm run check:contracts` falha se algum tipo divergir em qualquer sentido. Ao mudar um tipo, altere os dois lados e rode o check.

---

## 📁 Estrutura

```text
app.ts                      # createApi(container): middlewares, docs, rotas, erros; e o start do servidor
contract-check/             # Verificação de paridade de tipos com o frontend
tests/
  integration/              # Fluxos entre módulos pelo container (sem HTTP); support.ts tem os atalhos
  setup/                    # O seed de demonstração
  postgres/                 # O que só o banco prova: reinício, tabelas iguais à memória, restrições, arquivos
  support/                  # postgres.ts: schema novo por teste quando há TEST_DATABASE_URL
  e2e/                      # smoke.e2e.ts (HTTP de verdade) + support/openapi-check.ts; http/ com requisições manuais
src/
  container.ts              # Raiz de composição: escolhe as implementações e monta os casos de uso de cada módulo
  repositories.ts           # Todos os repositórios (Repositories): a versão em memória e a em PostgreSQL
  postgres.ts               # Liga o PostgreSQL: conexão, migrações, arquivos e o seed de uma vez só
  migrations/               # Passos do esquema do banco, em ordem (001-initial.ts)
  routes.ts                 # Os grupos de rotas de cada módulo, na ordem de cada prefixo
  seed.ts                   # Seed de demonstração (as trilhas ficam em seed-tracks.ts)
  docs/                     # Registro de todos os schemas OpenAPI e montagem do documento
  contracts/                # Barrel do contrato da API (reexporta os *.contract.ts) para o check:contracts
  modules/                  # Uma fatia vertical por contexto de negócio:
                            #   accounts, auth, farmers, workers, farms, services, hiring, reviews,
                            #   chat, media, notifications, system-users, admin, platform, tracks
    <módulo>/
      index.ts              #   API pública: o único arquivo que outro módulo enxerga (#modules/<módulo>)
      <módulo>.module.ts    #   Monta os casos de uso (container) e as rotas (src/routes.ts)
      <nome>.contract.ts    #   Contrato da API do módulo
      domain/               #   Porta do repositório e regras puras
      application/          #   Um caso de uso por arquivo (*.usecase.ts), com o teste ao lado (*.spec.ts)
      infra/                #   Implementações (repositório em memória e em PostgreSQL; Web Push em notifications)
      presentation/         #   Controller, rotas, parsers do corpo e schemas OpenAPI
      testing/              #   Fixtures dos testes (fora do build)
  shared/
    contracts/              # ApiError e MessageResponse
    domain/                 # Result, Clock, datas, Repository<T, K> e portas transversais (imagens, documentos, senhas, tokens, avisos)
    infra/http/             # route(), contrato de acesso (Access), tipos dos handlers, corpo, erros, SSE
    infra/docs/             # Kit do OpenAPI: helpers de schema, operation(), schemas genéricos
    infra/                  # crypto (scrypt, HMAC), images (Sharp + store), documents, memory, postgres
    testing/                # unwrap(), fixedClock() e dublês que gravam avisos e pushes (fora do build)
    utils/                  # Validações (e-mail, CPF, senha), busca sem acento e perfil público (CPF mascarado)
    config.ts               # Variáveis de ambiente
```

### Camadas e módulos

Dentro de um módulo: `presentation → application → domain ← infra`. Os casos de uso dependem só das portas (ex.: `FarmRepository`), nunca da implementação; a persistência entra em `createContainer({ repos })`: os repositórios em memória (padrão) ou os de PostgreSQL (`src/postgres.ts`). Os repositórios devolvem cópias (como um banco): alterar uma entidade só vale depois de `update`.

Imports: dentro do módulo, relativos; entre módulos, só `#modules/<módulo>` (o alias resolve apenas o `index.ts`, então import profundo em outro módulo não compila); infraestrutura comum, `#shared/...`. Os aliases ficam em `"imports"` do `package.json`: com a condição `development` (`tsx --conditions=development`, usada por todos os scripts, e o type-check) apontam para os `.ts`; o `node dist/` usa os `.js` compilados.

Regras de fronteira:

- `src/shared` não importa módulos. A única exceção é o tipo `Principal` (quem está logado: uma `Account` ou um usuário de sistema), que o HTTP compartilhado carrega em `res.locals`.
- Alguns módulos se importam nos dois sentidos (ex.: `farms` ↔ `services`, `services` ↔ `hiring`). Por isso, valor de outro módulo só é lido dentro de funções, nunca no carregamento do arquivo (nada de `const X = [OUTRO_MODULO.Y]` no topo).
- Quando um módulo precisaria chamar outro que já depende dele, ele declara uma porta e o container liga (ex.: `ProfileFactory` em `accounts`, implementada com os casos de uso de `farmers` e `workers`).
- Cada schema OpenAPI fica no módulo dono; um módulo só cita os nomes que declara ou importa (`operation<NomesDoMódulo>`), e `src/docs/schemas.ts` confere que todos existem.

---

## 💾 Armazenamento

A API guarda os dados em **PostgreSQL** quando `DATABASE_URL` está definida. Sem ela, tudo fica **em memória** e some a cada reinício: é assim que rodam os testes e o `npm run dev` de quem não quer subir um banco. A escolha acontece na subida (`bootContainer`, em `app.ts`); rotas, controllers e regras são os mesmos nos dois casos.

### Ligar o PostgreSQL

1. Crie um banco vazio: `createdb ruraliza` na sua máquina, ou um PostgreSQL no provedor (Render).
2. Ponha o endereço em `DATABASE_URL`, no `.env` ou nas variáveis do Render: `postgres://usuario:senha@localhost:5432/ruraliza`. Se o provedor exigir TLS, acrescente `?sslmode=require`.
3. Suba a API (`npm run dev` ou `npm start`). Ela cria as tabelas e aplica os passos pendentes do esquema sozinha. Se o banco estiver fora do ar ou a URL errada, a API não sobe.

Defina também `AUTH_TOKEN_SECRET`: sem ele, os dados continuam depois do reinício, mas todas as sessões caem.

### O que fica onde

| O quê | Com `DATABASE_URL` | Sem `DATABASE_URL` |
|---|---|---|
| Entidades (os 23 repositórios de `src/repositories.ts`) | Uma tabela por repositório, uma coluna por campo: `PgRepository` (`src/shared/infra/postgres/`) e o `infra/pg-*.ts` de cada módulo | Array em memória com id sequencial: `InMemoryRepository` (`src/shared/infra/memory/`) |
| Fotos, currículos e fotos de documento da verificação | Tabela `stored_files`, um `store` por tipo: `PgFileStore`. Com `SUPABASE_*`, um bucket privado do Supabase Storage, uma pasta por tipo: `SupabaseFileStore` | `Map` em memória: `InMemoryImageStore`, `InMemoryDocumentStore` |
| Tratamento das fotos | Processado no upload, não é guardado: `SharpImageProcessor` | O mesmo |
| Avisos para as telas abertas (SSE) | Memória do processo: `InMemoryChangeFeed` | O mesmo |

- As duas implementações cumprem a mesma porta, `Repository<T, K>` (`src/shared/domain/repository.ts`): `find(criteria)` é só igualdade de campos, e toda leitura devolve uma cópia, então alterar uma entidade só vale depois de `update`.
- As entidades guardam **só a URL** da foto (`photo_url`, `farm.photos[].url`), nunca os bytes. Hoje a URL é `/api/images/<uuid>.webp`, servida por `GET /api/images/:id` com cache imutável.
- Toda foto enviada passa pelo `SharpImageProcessor` antes de ser guardada: corrige a rotação do celular, reduz para **no máximo 1000 px no maior lado** (sem ampliar fotos pequenas), converte para **WebP (qualidade 78)** e remove os metadados (EXIF/GPS). Fotos de perfil saem sempre **quadradas** (até 1000×1000 px): o app envia a foto já recortada pelo usuário e, se chegar outra proporção, o servidor recorta o quadrado central. Arquivos que não são imagem são recusados com 400. Uploads acima de 10 MB são recusados com 413.
- O currículo do trabalhador segue o mesmo esquema, sem processamento: o PDF é guardado como chegou, depois de conferir a assinatura `%PDF-` (outro arquivo dá 400; acima de 5 MB, 413). O trabalhador guarda só `resume_url` (`/api/documents/<uuid>.pdf`), servida por `GET /api/documents/:id`.
- A senha **não fica no perfil**: vai para o repositório `accounts` (`email`, `password_hash`, `farmer_id`, `worker_id`, `last_role`), então nunca sai numa resposta. Uma conta por e-mail e por CPF, com até um perfil de cada tipo e a mesma senha para os dois. O hash é **scrypt** com sal aleatório (`src/shared/infra/crypto/node-crypto.ts`). O pedido de "esqueci a senha" guarda só o SHA-256 do token, com validade de 30 minutos.

### Esquema e migrações

- O esquema é uma lista de passos em `src/migrations/` (hoje só `001-initial.ts`). Cada passo roda uma vez por banco, numa transação, e fica anotado na tabela `schema_migrations`. **Nunca edite um passo já aplicado:** mudança de esquema é um arquivo novo, acrescentado no fim de `MIGRATIONS` (`src/migrations/index.ts`).
- Campo novo numa entidade pede três mudanças juntas: o passo de migração, a lista de colunas no `infra/pg-*.ts` do módulo (o compilador recusa uma lista incompleta) e, se o campo sai na API, o contrato e o schema OpenAPI.
- Convenções: `id integer` gerado pelo banco; instante em `timestamptz` e dia do calendário (`expires_at`, `starts_on`, `ends_on`) em `date`; lista simples em `integer[]`/`text[]`; objeto ou lista de objetos (`farm.photos`, os módulos de uma trilha, `preferences`) em `jsonb`.
- **Unicidade no banco.** As regras de "um só" viram `UNIQUE`: e-mail e CPF de produtor e de trabalhador, e-mail da conta e da equipe, uma candidatura por trabalhador e serviço, no máximo uma candidatura aceita e um pagamento por serviço, uma avaliação de cada lado por serviço, uma conversa por contratação, uma matrícula e um certificado por trilha e trabalhador. Os casos de uso continuam conferindo antes de gravar; se duas requisições passarem juntas pela conferência, o banco recusa a segunda e a API responde **409**.
- Chaves estrangeiras só na conta (`accounts.farmer_id`/`worker_id`, `ON DELETE SET NULL`) e nas mensagens (`chat_messages.chat_id`, `ON DELETE CASCADE`). A limpeza de um perfil removido continua nos casos de uso (`ProfileCleanup`).

### Seed e administrador com banco

- O seed de demonstração roda **uma vez por banco**, numa transação, e fica anotado como `demo-seed` em `schema_migrations`. Nas subidas seguintes nada é recriado: o que as pessoas mudaram (inclusive a senha de uma conta de teste) continua como está.
- `SEED_DEMO=false` impede o seed num banco novo, mas **não apaga** contas de teste já gravadas. Antes de ter dados de verdade, comece com um banco novo e `SEED_DEMO=false`, ou remova as contas de teste em `/sistema`.
- Sem seed e sem `ADMIN_EMAIL`/`ADMIN_PASSWORD`, o administrador padrão `admin@ruraliza.app` é criado na primeira subida e a senha sorteada aparece só naquele log. Para escolher a senha, defina as duas variáveis.

### Arquivos: no banco ou no Supabase Storage

Sem outra configuração, fotos e currículos ficam no próprio PostgreSQL (`stored_files`, coluna `bytea`). É a opção que funciona sem outro serviço: o disco do servidor publicado some a cada deploy. As fotos são pequenas (WebP de até 1000 px) e os PDFs têm até 5 MB.

Para tirar os bytes do banco, ligue um **bucket privado do Supabase Storage**:

1. No painel do Supabase, crie o bucket em Storage → New bucket, com "Public bucket" **desmarcado**.
2. Defina `SUPABASE_URL` (`https://<projeto>.supabase.co`), `SUPABASE_SERVICE_KEY` (a chave secreta, em Project Settings → API Keys) e `SUPABASE_BUCKET`, no `.env` ou nas variáveis do Render. As três juntas, e junto com `DATABASE_URL`.
3. Suba a API. Ela confere o bucket na subida: chave errada, bucket inexistente ou **público** impedem a subida.

O que muda e o que não muda:

- As URLs continuam as mesmas (`/api/images/<uuid>.webp`, `/api/documents/<uuid>.pdf`) e os arquivos continuam saindo pelas rotas da API, que conferem quem pode ver. O navegador nunca fala com o bucket, e por isso ele não precisa de políticas de acesso (RLS).
- Cada tipo é uma pasta do bucket (`images`, `documents`, `id_documents`). O id pedido só é aceito no formato que a API gera, então a rota pública das fotos não alcança a pasta das fotos de documento.
- O que já estava em `stored_files` continua sendo lido e apagado por lá; só os arquivos novos vão para o bucket.
- A chave de serviço ignora as regras do bucket: fica só no servidor.

Para outro serviço (S3, Cloudflare R2), implemente `ImageStore` e `DocumentStore` (`src/shared/domain/`) e passe em `createContainer({ images, documents, idDocuments })`, como o `SupabaseFileStore` (`src/shared/infra/supabase/`).

### O que ainda não usa o banco

- **Transações fora da contratação.** Aceite, desistência e pagamento já gravam tudo junto (`Transaction`, em `src/shared/domain/transaction.ts`: o caso de uso recebe repositórios sobre uma conexão em transação; se algo falha, nada fica gravado). Cancelamento de serviço, avaliação, troca de e-mail e remoção de perfil ainda gravam em sequência: uma queda no meio deixa a operação pela metade. As corridas entre requisições são barradas pelas restrições `UNIQUE`. Para levar a transação a outro caso de uso, siga o do pagamento (`grep -rn "TODO(db)" src`).
- **Consultas.** A busca de vagas, a listagem de trilhas, a reputação e o painel da fazenda leem as linhas e filtram na aplicação. No banco, viram `WHERE`, `unaccent` + `ILIKE` e `AVG`/`COUNT` (comentários `TODO(db)`).
- **Uma instância só.** Os avisos por SSE valem para um processo; com várias instâncias, troque o `ChangeFeed` por LISTEN/NOTIFY ou Redis.

### Testes com banco

`npm test` roda tudo em memória e não precisa de banco. Para provar a persistência, aponte `TEST_DATABASE_URL` para um banco **só de testes** e rode:

```bash
createdb ruraliza_test
TEST_DATABASE_URL=postgres://localhost:5432/ruraliza_test npm run test:postgres
```

Roda `tests/postgres` (reinício do servidor, cada tabela comparada com o repositório em memória, restrições, arquivos) e repete os testes de integração e o e2e sobre o PostgreSQL. Cada container de teste usa um schema novo, apagado no fim. O CI roda esse comando com um PostgreSQL de serviço.

---

## 🛣️ Rotas

Erros sempre no formato `{ "error": "mensagem" }` com o status correto (400 validação, 401 sem sessão válida ou e-mail/senha incorretos, 403 sem permissão, 404 não encontrado, 409 conflito). POST/PATCH de sucesso devolvem `{ message, <entidade> }`; GET devolve o recurso ou a lista.

Status na API (em inglês): serviço `Pending | In Progress | Completed | Rejected | Cancelled`; candidatura `Pending | Accepted | Rejected`; pagamento `Completed`.

CPF: enviado com 11 dígitos, só números, com dígitos verificadores válidos. Em listas e respostas embutidas sai mascarado (`***.456.789-**`).

### Acesso (`/api/auth`)

Uma **conta por pessoa** (e-mail e CPF únicos), com senha de 8 a 128 caracteres enviada no cadastro em `password`. O cadastro exige `accept_terms: true` ("Li e concordo com os Termos de Uso e a Política de Privacidade", textos em `/termos` e `/privacidade` no frontend): a conta guarda `terms_version` e `terms_accepted_at`, para provar o consentimento (LGPD). Ao mudar os textos, troque `TERMS_VERSION` (`src/modules/accounts/domain/terms.ts`) e a do frontend. A conta começa com o perfil escolhido no cadastro (`POST /api/farmers` ou `POST /api/workers`, que já devolvem a sessão em `user`) e pode ganhar o outro perfil depois (`/api/accounts`). A mesma senha vale para os dois. A sessão (`user`) é `{ account_id, role, id, profiles: { farmer, worker } }`: `role`/`id` são o painel aberto.

**Token de sessão.** Login, redefinição de senha e cadastro devolvem `token` (assinado com HMAC-SHA256 e `AUTH_TOKEN_SECRET`, válido por 12 horas). Toda rota que não é pública exige `Authorization: Bearer <token>` e confere o dono: uma conta só mexe nos próprios perfis, fazendas, serviços e candidaturas (`farmer_id`/`worker_id` no corpo ou na query precisam ser os dela). Sem token ou com token inválido/vencido: **401**; token de outra pessoa ou de outro tipo de usuário: **403**. O token diz só quem entrou; conta e perfis são relidos a cada requisição, então uma conta removida perde o acesso na hora. As regras ficam em `src/modules/auth/presentation/access.ts` e cada rota declara a sua em `route()` (a documentação mostra o cadeado e quem pode).

Rotas públicas: login e redefinição de senha, cadastro (`POST /api/farmers` e `POST /api/workers`), categorias, configuração, health, imagens e currículos (`/api/images/:id` e `/api/documents/:id`, lidos por `<img>` e links, com ids aleatórios). Nas duas rotas SSE o token também vale em `?access_token=`, porque o `EventSource` do navegador não envia cabeçalhos.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` → `{ message, user, token }`, abrindo o último painel usado; 401 se e-mail ou senha não conferem (mesma mensagem nos dois casos) |
| POST | `/api/auth/password-reset` | Esqueci a senha, passo 1: `{ email }`. Sempre o mesmo 200 (`{ message }`), com ou sem conta para o e-mail, e **nunca devolve o código**: ele vai só para o dono do e-mail. Vale 30 min e uma vez só; um pedido novo invalida o anterior. **O envio por e-mail ainda não existe**: em produção nenhum código é criado (a redefinição fica desligada); no `npm run dev`, o código aparece no terminal da API |
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
| GET | `/api/accounts/:id/preferences` | Preferências de exibição da conta: `{ theme: 'light' \| 'dark' \| 'system', text_size: 'normal' \| 'large', high_contrast }`. Padrão: tema claro, texto normal, sem alto contraste. Valem nos dois painéis e em qualquer aparelho |
| PATCH | `/api/accounts/:id/preferences` | Muda só os campos enviados (ao menos um); 400 se nenhum vier ou se algum valor for inválido |
| POST | `/api/accounts/:id/push-subscriptions` | `{ endpoint, keys: { p256dh, auth } }` (o `PushSubscription.toJSON()` do navegador): ativa as notificações push neste navegador, para os dois perfis da conta. Reenviar a mesma inscrição não duplica |
| DELETE | `/api/accounts/:id/push-subscriptions` | `{ endpoint }`: desativa as notificações neste navegador |

Quem tem os dois perfis **não pode se candidatar a um serviço que publicou** como produtor (`POST /api/workers/services/:id/apply` responde 409).

### Produtor (`/api/farmers`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/farmers` | Lista produtores (só administração) |
| POST | `/api/farmers` | Cadastra (`email`, `name`, `phone`, `cpf`, `password`, `accept_terms: true`); 400 sem o aceite dos termos; 409 se e-mail/CPF já existe entre produtores |
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
| GET | `/api/farmers/services/:id/applications` | Candidaturas com o trabalhador embutido e a `reputation` dele. CPF, telefone e e-mail do trabalhador vêm **mascarados**: o contato só é trocado pela [conversa](#conversas) |
| GET | `/api/farmers/services/:id/events` | Acompanha as candidaturas em tempo real (SSE, ver [abaixo](#atualização-em-tempo-real-sse)); 404 se o serviço não existe |
| PATCH | `/api/farmers/services/:id/analyze` | `{ application_id, action: "Accept" \| "Reject" }` |
| POST | `/api/farmers/services/:id/payment` | Libera pagamento (simulação) de serviço `In Progress`; cria `Payment` |

### Trabalhador (`/api/workers`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/workers` | Lista trabalhadores (só administração) |
| POST | `/api/workers` | Cadastra (`email`, `name`, `phone`, `cpf`, `password`, `accept_terms: true`, opcionais `bio` (até 500), `experience`, `certificates`, `courses`); 400 sem o aceite dos termos |
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
| GET | `/api/workers/services` | Vagas abertas e dentro do prazo (com cidade/UF e fotos da fazenda). Filtros combináveis: `q` (palavras no nome, descrição, categoria ou cidade, sem diferenciar acentos), `category`, `min_hours`/`max_hours`, `from`/`to` (dia de publicação, `AAAA-MM-DD`), `min_rating` (só fazendas com média publicada a partir desta nota), `sort` (`recent`, `price_desc`, `price_asc`, `duration_asc`, `duration_desc`, `rating`); cada vaga traz `farm.reputation`; 400 se algum filtro for inválido |
| GET | `/api/workers/services/:id?worker_id=` | Detalhe da vaga. Com `worker_id` do trabalhador aceito no serviço, inclui `farm.latitude`/`farm.longitude` |
| POST | `/api/workers/services/:id/apply` | `{ worker_id }`; 409 se a vaga não está aberta, se o prazo terminou ou se já houve candidatura |
| GET | `/api/workers/tracks?q=&category=&worker_id=` | Trilhas de estudo publicadas (e, com `worker_id`, as descontinuadas em que ele está matriculado), com carga horária, tutores e `progress`; em andamento primeiro |
| GET | `/api/workers/tracks/:id?worker_id=` | A trilha antes de começar: descrição, tutores, carga e o sumário de módulos e aulas, sem o conteúdo |
| POST | `/api/workers/tracks/:id/enroll` | `{ worker_id }`; começa a trilha (repetir devolve a matrícula); 409 se descontinuada |
| GET | `/api/workers/:id/tracks/:trackId` | A trilha completa (aulas com vídeo e texto) e o progresso; 403 se não está matriculado |
| PUT / DELETE | `/api/workers/:id/tracks/:trackId/lessons/:lessonId/completion` | Conclui / desmarca a aula. A última aula que faltava emite o certificado (`issued_certificate`) |
| GET | `/api/workers/:id/certificates` | Certificados do trabalhador |
| PATCH | `/api/workers/services/:id/withdraw` | `{ worker_id }`; desiste e volta uma etapa: candidatura `Pending` é removida; se já aceito, o serviço volta a `Pending` e as candidaturas recusadas pelo aceite voltam a `Pending`; 409 se recusada ou serviço encerrado |

### Administração (`/api/admin`)

Usuários de sistema são a equipe do Ruraliza, separados das contas do app e **sem cadastro público**. Cada um tem um cargo (`role`): `admin` gerencia as contas do app e a equipe, supervisiona todas as trilhas de estudo (`tracks:oversee`: vê, cria escolhendo os tutores, edita e descontinua qualquer uma), edita a central de ajuda (`content:manage`) e modera denúncias e verificações (`moderation:manage`); `tutor` cria trilhas e edita as de que é tutor (`tracks:manage`). As rotas pedem uma permissão, não um cargo; o mapa cargo → permissões fica em `src/modules/system-users/domain/system-user.ts`.

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
| GET | `/api/admin/tracks` | (tutor e administrador) Todas as trilhas, em qualquer status; `can_edit` diz quais quem pediu pode editar (o administrador, todas) |
| GET | `/api/admin/tracks/tutors` | (tutor e administrador) Usuários de sistema com cargo tutor |
| POST | `/api/admin/tracks` | Cria em rascunho: `{ title, description, categories, tutor_ids? }`. O tutor que cria vira tutor; o administrador indica ao menos um tutor em `tutor_ids` |
| GET / PATCH | `/api/admin/tracks/:id` | Detalhe / edita `title`, `description`, `categories` e `tutor_ids`. Só os tutores da trilha e o administrador editam (403 para os outros tutores) |
| PUT | `/api/admin/tracks/:id/content` | Substitui módulos e aulas (`{ modules: [{ id?, title, lessons: [{ id?, title, video_url?, content?, duration_minutes }] }] }`). Com `id` mantém o item; ids nunca são reaproveitados |
| PATCH | `/api/admin/tracks/:id/status` | `{ status: "published" \| "discontinued" }`. Não há remoção nem volta para rascunho; 409 se a transição não vale ou se faltam aulas |

### Filtro de palavrões

Títulos e descrições de vagas (publicar e editar) e os textos do perfil do trabalhador (apresentação, experiência, certificados e cursos) são recusados com **400** quando têm palavrão ou ofensa: "Há palavras não permitidas no nome do serviço. Reescreva sem palavrões nem ofensas." A lista (`src/shared/domain/moderation.ts`) pega acento, maiúscula, letra repetida e número no lugar da letra (`p0rr4`), só com a palavra inteira (`curral` passa), e deixa de fora de propósito palavras com sentido comum no campo (`bosta` de vaca, `Cu` de cobre, `pica-pau`, `macaco` hidráulico, milho `crioulo`...). O frontend usa a mesma lista para avisar antes de enviar, e o `npm run check:contracts` confere que as duas são iguais.

### Denúncias

Quem usa o app avisa a equipe sobre vaga falsa, condições ruins de trabalho, mau comportamento ou conteúdo ofensivo. O trabalhador denuncia uma vaga (qualquer uma, mesmo sem candidatura: a vaga falsa aparece antes do contato) ou um produtor a cuja vaga se candidatou; o produtor denuncia um trabalhador que se candidatou a um serviço dele. Ninguém denuncia a si mesmo (nem o outro perfil da conta), e a mesma pessoa não denuncia o mesmo alvo de novo enquanto a equipe analisa (409). O relato (`details`, até 500 caracteres, obrigatório no motivo `outro`) **não** passa pelo filtro de palavrões, para quem denuncia uma ofensa poder contar o que ouviu; só a equipe lê, e quem foi denunciado não fica sabendo quem denunciou.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/workers/:id/reports` | `{ target_type: 'service' \| 'farmer', target_id, reason, details? }`; 403 se denunciar um produtor sem ter se candidatado a uma vaga dele |
| POST | `/api/farmers/:id/reports` | `{ target_type: 'worker', target_id, reason, details? }`; 403 se o trabalhador não se candidatou a um serviço do produtor |
| GET | `/api/admin/reports?status=` | (`moderation:manage`) A fila, a mais recente primeiro, com os nomes e as contas de quem denunciou e do alvo (no caso de uma vaga, a conta da produtora), para abrir em `/api/admin/users/:id` |
| PATCH | `/api/admin/reports/:id` | `{ status: 'resolved' \| 'dismissed', note? }`: procedente ou descartada, com uma anotação interna. Quem denunciou recebe uma notificação com o resultado (sem a anotação); 409 se já foi decidida |

Motivos (`reason`): `fraude` (vaga falsa ou golpe), `condicoes` (condições de trabalho ruins ou perigosas), `comportamento` (assédio, ameaça, não cumpriu o combinado), `ofensivo` e `outro`. A decisão só registra o resultado: remover a conta ou editar o perfil é feito na administração de usuários.

### Verificação de identidade

A pessoa envia a foto da frente do RG ou da CNH; a equipe confere o nome e o CPF com os do perfil e aprova ou recusa (com o motivo, que a pessoa vê). Aprovado, o perfil ganha o **selo de verificado**: aparece para o produtor no cartão do candidato (`verified` em `GET /api/farmers/services/:id/applications`) e para o trabalhador nas vagas (`farm.farmer_verified` na busca e no detalhe). O selo vale para o nome conferido: se a pessoa muda o nome no perfil, ele some até ela verificar de novo. Quem tem os dois perfis com o mesmo CPF ganha o selo nos dois.

A foto do documento é dado pessoal sensível, então: é reduzida para no máximo 1600px (legível) e perde os metadados; fica num armazenamento **privado** (`idDocuments` no container), que não passa por `/api/images`; só a equipe vê, com o token de sistema; e é **apagada logo depois da decisão** (e quando o perfil é removido). Com PostgreSQL, o pedido fica na tabela `verifications` e a foto, no armazenamento `id_documents` (de `stored_files` ou, com `SUPABASE_*`, do bucket privado), que nenhuma rota pública lê.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/farmers/:id/verification` e `/api/workers/:id/verification` | Situação: `status` (`none`, `pending`, `approved`, `rejected`), `rejection_reason` e `verified` (o selo aparece) |
| POST | `/api/farmers/:id/verification?document_type=rg\|cnh` e o mesmo em `/api/workers` | A foto no corpo (Content-Type image/*, até 10 MB); reenviar troca a foto e volta para a fila; 409 com o selo valendo |
| GET | `/api/admin/verifications?status=` | (`moderation:manage`) A fila, o envio mais antigo primeiro, com o nome e o CPF completos do perfil |
| GET | `/api/admin/verifications/:id/document` | A foto (WebP, `Cache-Control: private, no-store`), só enquanto está em análise |
| PATCH | `/api/admin/verifications/:id` | `{ status: 'approved' \| 'rejected', reason? }` (motivo obrigatório ao recusar). Apaga a foto e avisa a pessoa |

### Vagas para você (recomendações e avisos)

O trabalhador diz o que quer fazer (categorias), onde está ("perto de mim": a região, guardada com cerca de 1 km de precisão, e o raio) e se quer avisos. As vagas abertas são sugeridas pelo que combina: a categoria escolhida, as trilhas que ele faz (a concluída pesa mais) e, sem nada disso, as categorias das vagas em que já se candidatou; com "perto de mim", só entram as que ficam dentro do raio (em linha reta, calculada na API: o ponto da fazenda nunca sai). Fazenda bem avaliada e produtor verificado ajudam no desempate. Cada vaga vem com os motivos (`reasons`) e a distância aproximada (`distance_km`). Ficam de fora as vagas em que ele já se candidatou e as do próprio perfil de produtor.

Com os avisos ligados, quem combina com uma vaga nova (pela categoria escolhida ou pela trilha, e dentro do raio) recebe na hora "Vaga nova perto de você" (no sino e no push), no máximo 3 por dia e nunca a mesma vaga duas vezes; uma vez por semana sai o resumo "Encontramos N vagas para você" (o servidor confere a cada hora quem já pode receber).

| Método | Rota | Descrição |
|---|---|---|
| GET / PUT | `/api/workers/:id/job-preferences` | `{ categories, near: { latitude, longitude, radius_km } \| null, alerts }`; o PUT troca tudo (raio de 5 a 300 km) |
| GET | `/api/workers/:id/recommended-jobs?limit=` | As vagas que combinam (1 a 30; padrão 10), da que mais combina para a que menos |

### Painel da fazenda

`GET /api/farmers/:id/stats` traz os números do produtor, em todas as fazendas dele: horas e serviços concluídos (com o pagamento liberado, que é quando o trabalho fica validado no app), quanto foi pago, quantas pessoas já trabalharam com ele e quantas voltaram, a nota média das fazendas (pesada pela quantidade de avaliações de cada uma), as vagas abertas e as candidaturas esperando resposta, os últimos 6 meses (meses sem serviço vêm zerados), as categorias e a lista de quem já passou por lá (até 20, o mais recente primeiro).

### Patrocínios

Espaço para lojas agropecuárias, revendas de máquinas e marcas de sementes: um cartão marcado como **Patrocinado** no Início de produtores e trabalhadores (identificar o anúncio como anúncio é exigência do Código de Defesa do Consumidor). A equipe (permissão `content:manage`) cadastra o anunciante, a chamada, o link (sempre https), a logo, o público (`farmer`, `worker` ou `all`), as UFs, as categorias de interesse (para trabalhadores) e o período, e acompanha as aparições e os cliques. A rotação mostra, entre os que servem, o que menos apareceu. **Nenhum dado de quem usa o app vai para o anunciante:** o cartão é pedido sem login, com a UF e as categorias na própria URL, e o link abre direto a página do anunciante.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/sponsors/slot?audience=&state=&categories=` | (público) O cartão da vez (`card: null` quando não há); conta a aparição |
| POST | `/api/sponsors/:id/click` | (público) Conta o clique (o app chama ao abrir o link) |
| GET / POST | `/api/admin/sponsors` | Lista (com aparições e cliques) / cria |
| PATCH / DELETE | `/api/admin/sponsors/:id` | Edita / apaga (com a imagem) |
| POST / DELETE | `/api/admin/sponsors/:id/image` | Envia / tira a logo (WebP, até 1000px) |

### Central de ajuda

Perguntas frequentes que a equipe edita sem mexer no código. A lista pública não exige login; a gestão pede a permissão `content:manage` (cargo administrador). As perguntas padrão (26, em 7 temas) são criadas ao subir o servidor (`createDefaultHelpArticles`, pelo seed).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/help` | Perguntas publicadas, por tema (`comecar`, `produtores`, `trabalhadores`, `pagamentos`, `seguranca`, `trilhas`, `conta`) e na ordem da tela |
| GET | `/api/admin/help` | Todas, inclusive os rascunhos (`published: false`) |
| POST | `/api/admin/help` | `{ question, answer, topic, published? }`: entra no fim do tema |
| PATCH | `/api/admin/help/:id` | Muda só o que veio; mudou de tema, vai para o fim do tema novo |
| PATCH | `/api/admin/help/:id/move` | `{ direction: 'up' \| 'down' }`: troca de lugar com a vizinha no tema |
| DELETE | `/api/admin/help/:id` | Apaga a pergunta |

### Avaliações

**Avaliação dupla** depois do serviço concluído (pagamento liberado): o produtor avalia o trabalhador (pontualidade, empenho e qualidade) e o trabalhador avalia a fazenda (infraestrutura, condições de trabalho e se o serviço foi como o anúncio dizia). Notas inteiras de 1 a 5 e comentário opcional (até 500 caracteres).

- **Cega:** a nota de um lado só aparece para o outro (e entra na reputação) quando os dois avaliaram, ou quando o prazo acaba. Assim ninguém avalia "de troco".
- **Prazo de 14 dias** depois do pagamento. Depois disso ninguém avalia mais e o que foi escrito é publicado.
- **Uma vez só:** a avaliação não pode ser editada.
- **Reputação:** média geral, média por critério e quantidade. O campo `score` é uma média ponderada (bayesiana, começa em 3,5 com peso 2), usada para ordenar: quem tem uma nota 5 não passa na frente de quem tem vinte notas 4,8.
- **Sem identificar quem escreveu:** nas listas, quem avaliou aparece como "Produtor em Três Rios, RJ" ou pelo primeiro nome do trabalhador.
- Ao remover um perfil, as avaliações em que ele aparece saem junto (os serviços e fazendas do produtor também somem).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/farmers/services/:id/reviews` | O produtor vê as avaliações do serviço: a que deu (`given`), a que a fazenda recebeu (`received`, só publicada), `received_hidden` (o trabalhador já avaliou e espera a dele) e `can_review` |
| POST | `/api/farmers/services/:id/review` | `{ punctuality, effort, quality, comment? }`; 409 se o serviço não foi concluído, se já avaliou ou se o prazo terminou |
| GET | `/api/farmers/:id/reviews/pending` | Serviços concluídos esperando a avaliação do produtor (o que vence primeiro vem antes) |
| GET | `/api/workers/services/:id/reviews?worker_id=` | O mesmo do lado do trabalhador (403 se ele não fez o serviço) |
| POST | `/api/workers/services/:id/review` | `{ worker_id, infrastructure, conditions, as_described, comment? }` |
| GET | `/api/workers/:id/reviews/pending` | Serviços concluídos esperando a avaliação do trabalhador |
| GET | `/api/reviews/workers/:id` | Reputação e avaliações publicadas de um trabalhador (qualquer conta do app) |
| GET | `/api/reviews/farms/:id` | Reputação e avaliações publicadas de uma fazenda |

A reputação também vem embutida onde se escolhe: na lista de candidatos (`reputation`) e nas vagas (`farm.reputation`, com o filtro `min_rating` e `sort=rating`).

### Conversas

Conversa interna de cada contratação, para **proteger o WhatsApp** dos dois até haver confiança:

- **Abre no aceite** (com um aviso da plataforma), **fecha se o trabalhador desistir** e fica aberta por **7 dias depois do pagamento**. Fechada, continua legível. Se a mesma pessoa for aceita de novo, a conversa reabre com o histórico.
- **Consentimento duplo:** cada lado libera o próprio WhatsApp (`PATCH /api/chats/:id/phone`); os números (`farmer.phone`, `worker.phone`) só aparecem quando os dois liberaram. Antes disso, telefones e e-mails escritos nas mensagens saem como `[número oculto]`/`[e-mail oculto]`.
- A lista de candidatos não mostra mais telefone nem e-mail (vêm mascarados).
- **Não lidas** por pessoa; avisos da plataforma causados por quem agiu (aceitou, pagou, desistiu, liberou o WhatsApp) já contam como lidos para essa pessoa.
- Cada mensagem gera push para a outra parte; o pedido de WhatsApp também.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/farmers/:id/chats` e `/api/workers/:id/chats` | Conversas do perfil, a mais recente primeiro, com `unread` e `last_message` |
| GET | `/api/farmers/:id/chats/events` e `/api/workers/:id/chats/events` | SSE `event: chats`: alguma conversa do perfil mudou (lista e contador do menu) |
| GET | `/api/chats/:id` | A conversa com as mensagens (só o produtor e o trabalhador dela) |
| GET | `/api/chats/:id/events` | SSE `event: chat`: chegou mensagem ou mudou o WhatsApp liberado |
| POST | `/api/chats/:id/messages` | `{ body }` (até 1000 caracteres) → `{ message, sent, masked }`; 409 se a conversa foi encerrada |
| POST | `/api/chats/:id/read` | Marca a conversa como lida para quem pediu |
| PATCH | `/api/chats/:id/phone` | `{ share: true \| false }`: libera ou deixa de compartilhar o próprio WhatsApp |

### Outros
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/categories` | Lista fixa de categorias |
| GET | `/api/certificates/:code` | Validação pública de um certificado de conclusão (sem token), com o resumo SHA-256 dos dados (`data_hash`) |
| GET | `/api/config/push` | Chave pública VAPID das notificações push; 503 se as chaves não estiverem no `.env` |
| GET | `/api/config/maps` | Chave e Map ID do Google Maps (`.env`); 403 se o `Origin` não for do frontend, 503 se a chave não estiver configurada |
| GET | `/api/images/:id` | Serve uma foto (WebP, cache imutável de 1 ano) |
| GET | `/api/documents/:id` | Serve um currículo (PDF, cache imutável de 1 ano) |

**Localização da fazenda:** o produtor marca o ponto no mapa (`latitude`/`longitude`, obrigatórias no cadastro; fazendas antigas podem ter `null`). O trabalhador só recebe as coordenadas nos serviços em que foi aceito; nas vagas abertas vê apenas cidade/UF.

### Trilhas de estudo

Cursos para os trabalhadores, divididos em módulos e aulas (vídeo do YouTube/Vimeo e/ou texto em Markdown simples, com a duração em minutos; a carga horária é a soma). Os tutores montam; a trilha nasce em rascunho e segue `draft → published ⇄ discontinued`. Descontinuada some da lista e não aceita alunos novos, mas quem já começou termina. Ao concluir a última aula, o trabalhador recebe um certificado em nome da Ruraliza (nome, trilha, carga horária e data de conclusão, guardados como estavam na emissão) com um código validado em `/api/certificates/:code`. Na emissão também é calculado e guardado o **resumo SHA-256** desses dados (`data_hash`): o SHA-256, em hex, do JSON `[code, worker_name, track_title, workload_minutes, completed_at]` sem espaços, em UTF-8. O PDF do app traz o resumo e um QR code que abre a página de validação, onde o resumo aparece de novo; qualquer mudança nesses dados muda o resumo, e qualquer pessoa pode recalculá-lo (ex.: `printf '%s' '["RZ-…","Nome","Trilha",90,"2026-…Z"]' | sha256sum`). Não é assinatura digital: quem garante o certificado continua sendo a validação pelo código.

### Atualização em tempo real (SSE)

As telas de candidatos do serviço (produtor) e de candidaturas (trabalhador) se atualizam sozinhas por **Server-Sent Events**: o frontend abre `GET .../events` com `EventSource`, a resposta (`text/event-stream`) fica aberta e chega `event: applications` a cada mudança. O aviso não traz dados; a tela busca a lista de novo pela rota de sempre. A cada 25 s vai um `: ping` para a conexão não ser cortada por inatividade, e o `EventSource` reconecta sozinho se ela cair.

Os casos de uso publicam os avisos (`ChangeFeed`, `src/shared/domain/changes.ts`) depois de cada mudança: candidatura, desistência, aceite/recusa (inclusive as recusadas pelo aceite e as que voltam a `Pending`), edição, cancelamento e pagamento do serviço, avaliação, e remoção de produtor ou trabalhador. As conversas têm dois canais próprios: o da conversa aberta (`event: chat`) e o da lista de cada perfil (`event: chats`). **Uma conexão por aba:** o que vale para a tela inteira (a lista de conversas do menu, o sino e, no trabalhador, as candidaturas) chega por um stream só do perfil, `GET /api/farmers/:id/live` e `GET /api/workers/:id/live` (`event: chats`, `event: notifications` e, no trabalhador, `event: applications`). Em HTTP/1.1 o navegador abre no máximo 6 conexões por servidor: com um stream por assunto, duas abas do app esgotavam o limite e as outras requisições ficavam esperando. Os streams por assunto continuam valendo. O app também fecha os streams quando a página vai para o cache de voltar/avançar (`pagehide`) e reabre na volta. A implementação em memória (`InMemoryChangeFeed`) só vale para **um processo**; com várias instâncias da API, troque por algo compartilhado (LISTEN/NOTIFY do PostgreSQL ou Redis pub/sub) em `createContainer({ changes })`.

### Central de notificações

Tudo o que vira push também fica guardado na **central de notificações** do perfil (`/api/farmers/:id/notifications` e `/api/workers/:id/notifications`), mesmo para quem não ativou o push no aparelho: é o histórico do sino da barra de cima do app.

- Cada perfil guarda até **100 avisos** (os mais antigos saem); a lista devolve os 50 mais recentes e o total de **não lidos**.
- Avisos iguais ainda não lidos (mesmo título e mesma tela, ex.: 3 mensagens na mesma conversa) viram **um só**, com o texto do mais recente e a contagem em `count`.
- `POST .../notifications/read` marca como lidos (sem `ids`, todos). O sino acompanha por SSE (`.../notifications/events`, `event: notifications`).
- Ao remover um perfil, o histórico dele sai junto (`NotificationRepository`).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/farmers/:id/notifications` e `/api/workers/:id/notifications` | `{ unread, items: [{ id, title, body, url, count, read, insertion_date }] }`, os mais recentes primeiro |
| POST | `/api/farmers/:id/notifications/read` e `/api/workers/:id/notifications/read` | `{ ids? }`: marca como lidos (ids de outro perfil são ignorados) → `{ message, unread }` |
| GET | `/api/farmers/:id/notifications/events` e `/api/workers/:id/notifications/events` | SSE `event: notifications`: chegou aviso novo ou algum foi lido |

### Notificações push

Com o app fechado, quem precisa agir recebe uma notificação (**Web Push**, chaves VAPID do `.env`): o produtor quando alguém se candidata ou desiste; o trabalhador quando é aceito, recusado (inclusive pelo aceite de outro), quando o serviço é cancelado e quando o pagamento é liberado (o clique abre a vaga, onde ele avalia a fazenda); os dois quando chega mensagem na conversa, quando o outro pede para trocar WhatsApp e quando o outro avalia ("avalie também para ver a nota"). A mensagem segue o formato do service worker do Angular (`notification.data.onActionClick`), e o clique abre o app na tela certa.

O envio (`PushDispatcher`, `src/modules/notifications/infra/web-push-sender.ts`) roda em segundo plano: falha no serviço de push só vai para o log, nunca para a resposta. Inscrições que o navegador revogou (404/410) são apagadas no primeiro envio. As inscrições ficam guardadas como o resto dos dados; o frontend reenvia a dele a cada abertura do app.

**Prazo das vagas (`expires_at`):** dia do calendário. A vaga aceita candidaturas até o fim desse dia no horário de Brasília. Depois disso continua `Pending` para o produtor, mas some da busca e recusa candidaturas (409) até o produtor renovar a data. Não dá para publicar ou editar com data no passado (400).

---

## 🛠️ Próximos passos
- [x] Banco de dados: PostgreSQL com `DATABASE_URL` (ver [Armazenamento](#-armazenamento)).
- [ ] Transações nos demais casos de uso que gravam várias entidades (cancelamento, avaliação, remoção de perfil; aceite, desistência e pagamento já têm) e consultas no banco para a busca e a reputação (`TODO(db)` no código).
- [x] Guardar as fotos num bucket em vez do banco (Supabase Storage, com `SUPABASE_*`).
- [ ] Enviar o código de redefinição de senha por e-mail (passar a entrega `deliverResetCode` ao `createContainer` em produção; ver `TODO(email)`). Até lá, a redefinição pública só funciona no `npm run dev`.
- [ ] Encerrar as sessões abertas ao trocar a senha (hoje o token vale até vencer).
- [x] Trilhas de estudo: rotas do tutor (`tracks:manage`), estudo pelo trabalhador e certificados.
- [ ] Registro de horas e relatórios em PDF.
- [ ] Assinatura digital dos certificados: a API gov.br é só para órgãos públicos; o caminho para o Ruraliza é um e-CNPJ ICP-Brasil.
- [ ] Avaliações: lembrete por push perto do fim do prazo de 14 dias (precisa de uma tarefa agendada) e moderação de comentários pela equipe (denúncia e remoção).
- [ ] Conversas: denunciar mensagem/bloquear, limite de mensagens por minuto, paginação das mensagens antigas e envio de foto (ex.: "cheguei na porteira").
- [ ] Reputação também a partir de sinais objetivos (ex.: desistências depois do aceite), com cuidado para não punir quem desistiu por motivo justo.
