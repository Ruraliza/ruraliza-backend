# Código e arquitetura

Visão técnica do que existe hoje. Rotas, variáveis e regras de negócio detalhadas ficam no [README](../README.md); o escopo do produto, em [PRODUCT.md](../PRODUCT.md). Os diagramas em Mermaid estão em [diagrams.md](diagrams.md).

## Stack

Versões de `package.json` (faixas, não fixas: o `package-lock.json` está no `.gitignore`).

| Camada | Escolha |
|---|---|
| Runtime | Node.js; em uso na máquina de referência: v24.19.0. O README pede "20 ou superior" e `package.json` não tem `engines` |
| Linguagem | TypeScript `^6.0.3`, módulos CommonJS (`"type": "commonjs"`), compilação com `tsc`, execução em dev com `tsx ^4.23` |
| HTTP | Express `^5.2.1`, `cors`, `swagger-ui-express` |
| Imagens e push | `sharp ^0.35` (WebP), `web-push ^3.6` |
| Testes | `node:test` rodado por `tsx`; `ajv` e `ajv-draft-04` para validar respostas contra o OpenAPI |
| Qualidade | `eslint ^10` com `typescript-eslint` (strict type-checked) e a regra local `quality/max-lines`, `tsc --noEmit` |
| Persistência | PostgreSQL com o driver `pg ^8.23` quando há `DATABASE_URL`; sem ela, repositórios em memória (ver "Dados") |

O acesso ao banco usa o `pg` direto, sem ORM. O `sequelize` continua em `dependencies`, mas nenhum arquivo o importa. O `pg-harness`, também sem uso, saiu em 18/10/2026 porque trazia vulnerabilidades críticas (ver [setup.md](setup.md)).

## Mapa do código

```text
app.ts                  createApi(container): CORS, parsers de corpo, docs, rotas, 404 e erros; main() sobe o servidor (bootContainer: PostgreSQL com DATABASE_URL, senão memória; seed sempre, menos com SEED_DEMO=false fora do --dev)
contract-check/         frontend-parity.ts: igualdade de tipos com ../ruraliza-frontend/src/app/core/models
src/container.ts        raiz de composição: escolhe implementações e monta os casos de uso
src/repositories.ts     interface Repositories, a versão em memória e a em PostgreSQL
src/postgres.ts         liga o PostgreSQL: pool, migrações, armazenamento de arquivos e o seed de uma vez só
src/migrations/         passos do esquema do banco, em ordem
src/routes.ts           grupos de rotas por prefixo (/api/auth, /api/farmers, /api/workers...), na ordem de registro
src/seed*.ts            dados de demonstração (vagas, histórico, trilhas, verificação)
src/docs/               geração do documento OpenAPI e registro dos schemas
src/contracts/          barrel que reexporta os *.contract.ts, usado pelo check:contracts
src/modules/<módulo>/   fatia por contexto (22 pastas): accounts, admin, auth, chat, farm-stats, farmers, farms, help,
                        hiring, live, matching, media, notifications, platform, reports, reviews, services, sponsors,
                        system-users, tracks, verification, workers
src/shared/             domain (portas e regras puras), infra (http, crypto, imagens, memória, postgres, docs), utils, testing, config.ts
tests/                  integration/ (container, sem HTTP), setup/ (seed), e2e/ (HTTP real + openapi-check.ts), postgres/ (o que só o banco prova), support/ (schema de teste)
docs/                   estes documentos e os diagramas (diagrams.md, diagrams/)
```

Dentro de um módulo, as pastas existem só quando há o que pôr nelas: `domain/` (porta do repositório e regras), `application/` (um `*.usecase.ts` por caso de uso, com `*.spec.ts` ao lado), `infra/` (repositório em memória, repositório PostgreSQL e adaptadores), `presentation/` (controller, `*.routes.ts`, parsers, `*.schemas.ts`), `testing/` (fixtures, fora do build), mais `index.ts`, `<módulo>.module.ts` e `<nome>.contract.ts`. Alguns módulos são menores: `live` tem só `presentation/`, `admin` e `farm-stats` não têm `domain/` nem `infra/`.

## Fluxo de uma requisição

1. `app.ts` aplica CORS e os parsers de corpo: `express.json()`, e `express.raw()` para `image/*` (10 MB) e PDF (5 MB).
2. O roteador do prefixo (`buildRouter`) encontra a rota declarada com `route(método, caminho, handler, operation({...}), access)`.
3. `route()` chama `access.authorize(req)`: confere o token Bearer e o dono do recurso antes do handler.
4. O controller valida `req.body` e `req.query` (chegam como `unknown`) com parsers do módulo e monta a entrada tipada.
5. O caso de uso roda a regra e devolve um `Result` (`ok` ou falha com `invalid`, `unauthorized`, `forbidden`, `not_found`, `conflict`), sem nada de HTTP.
6. `sendFailure` traduz a falha em 400, 401, 403, 404 ou 409 com `{ "error": "mensagem" }`.
7. O caso de uso chama a porta do repositório; a implementação (PostgreSQL ou memória) guarda e devolve cópias.
8. Erros não tratados caem no `errorHandler` global: 400 para JSON inválido, 413 para corpo grande, 409 quando o banco recusa um duplicado (`UNIQUE`), 400 para valor que o banco não guarda, 500 genérico para o resto (o detalhe vai só para o log).

## Camadas e fronteiras

`presentation -> application -> domain <- infra`. Casos de uso dependem só das portas. Imports: relativos dentro do módulo; entre módulos, só `#modules/<módulo>` (resolve apenas o `index.ts`); infraestrutura comum por `#shared/...`. Os aliases ficam em `imports` do `package.json`: com a condição `development` apontam para `.ts`, no `node dist/` para os `.js`.

Regras que o README já registra e valem aqui: `src/shared` não importa módulos (exceção: o tipo `Principal`); módulos que se importam nos dois sentidos só leem valores do outro dentro de funções; quando um módulo precisaria de outro que depende dele, declara uma porta e o container liga (`ProfileFactory`, `ProfileCleanup`). O README chama o padrão de "MVC", mas a estrutura real é essa de portas e casos de uso, não controllers acessando dados.

## OpenAPI e tempo real

- **OpenAPI** é gerado das mesmas rotas montadas (`buildOpenApiDocument(routeGroups)`), então não existe rota sem documentação nem sem regra de acesso. Servido em `/api/docs` (Swagger UI) e `/api/docs/openapi.json`. O e2e (`tests/e2e/smoke.e2e.ts`) valida toda resposta contra o documento: rota, status e corpo (campo a mais também falha).
- **SSE:** `src/shared/infra/http/sse.ts` abre `text/event-stream` com ping a cada 25 s. Há streams por assunto (candidaturas, conversa, lista de conversas, notificações) e um stream único por perfil, `GET /api/farmers/:id/live` e `/api/workers/:id/live`, criado para não esgotar as 6 conexões por servidor do HTTP/1.1. O aviso não leva dados: a tela busca a lista de novo. Os casos de uso publicam em `ChangeFeed` (`src/shared/domain/changes.ts`).

## Autenticação e acesso

- Login devolve token assinado com HMAC-SHA256 e `AUTH_TOKEN_SECRET`, válido por 12 horas, enviado em `Authorization: Bearer`. Nas rotas SSE vale também `?access_token=`.
- O token diz só quem entrou; conta e perfis são relidos a cada requisição.
- Cada rota declara um `Access` (`public`, `account` ou `system`). As políticas estão em `src/modules/auth/presentation/access.ts`.
- Usuários de sistema (`admin`, `tutor`) têm login próprio (`/api/auth/system/login`) e acesso por **permissão**, não por cargo; o mapa cargo -> permissões está em `src/modules/system-users/domain/system-user.ts`.
- Senhas com scrypt e sal; token de redefinição guardado só como SHA-256.

## Dados

A persistência é escolhida na subida (`bootContainer`, em `app.ts`) e entra pelo container: `createContainer({ repos, images, documents, idDocuments })`.

- **Com `DATABASE_URL`: PostgreSQL.** `openPostgres` (`src/postgres.ts`) abre o pool, aplica os passos pendentes de `src/migrations/` (anotados em `schema_migrations`, cada um numa transação e sob uma trava, para duas instâncias não migrarem juntas) e monta os 23 repositórios e os três armazenamentos de arquivos.
- **Sem `DATABASE_URL`: memória.** `InMemoryRepository` (`src/shared/infra/memory/`), `InMemoryImageStore` e `InMemoryDocumentStore`. É como rodam `npm test` e o desenvolvimento sem banco; tudo some ao reiniciar.

As duas cumprem `Repository<T, K>`: assíncrono, `find` por igualdade de campos na ordem do id, leitura sempre em cópia (alterar uma entidade só vale após `update`).

**Como o PostgreSQL está montado**

- `PgRepository` (`src/shared/infra/postgres/pg-repository.ts`) é um repositório genérico: uma tabela por entidade, uma coluna por campo. Cada módulo declara a sua tabela e a lista de colunas em `infra/pg-*.ts`; o tipo `Columns<T>` faz o compilador recusar um campo esquecido ou um opcional não marcado. Todo valor vai por parâmetro; nomes de tabela e coluna vêm só do código.
- Tipos: `id integer` gerado pelo banco, `timestamptz` para instantes, `date` para dias do calendário, `integer[]`/`text[]` para listas simples e `jsonb` para objetos (`farm.photos`, módulos das trilhas, `preferences`).
- Restrições `UNIQUE` repetem as regras de "um só" dos casos de uso. Se duas requisições passam juntas pela conferência, o banco recusa a segunda e o `errorHandler` responde 409.
- Arquivos (`PgFileStore`): fotos, currículos e fotos de documento da verificação na tabela `stored_files`, separados por `store`. A foto de documento fica em `id_documents`, que a rota pública `/api/images` não consulta. Com `SUPABASE_*`, os arquivos novos vão para um bucket privado do Supabase Storage (`SupabaseFileStore`, uma pasta por `store`), lido só pela API com a chave de serviço; o que já estava na tabela continua lido por lá.
- O seed roda uma vez por banco (`seedDemoOnce`: uma transação, anotada como `demo-seed`).
- `Database` é a interface mínima que os repositórios usam (`query`). O pool cumpre, e uma conexão em transação também (`inTransaction`), então os mesmos repositórios são montados dentro de uma transação.
- **Transações:** a porta `Transaction<R>` (`src/shared/domain/transaction.ts`) entrega ao caso de uso repositórios que gravam juntos. Aceite, recusa, desistência, propostas e pagamento (módulo `hiring`) usam; em memória ela roda direto, sem desfazer. Avisos (SSE), pushes e a conversa do serviço acontecem depois da transação, nunca dentro.

**O que ainda falta** (marcado com `TODO(db)` em `src/`): transação nos outros casos de uso que gravam várias entidades (cancelamento, avaliação, troca de e-mail, remoção de perfil); filtros e agregações feitos no banco (busca de vagas, trilhas, reputação, painel da fazenda); chaves estrangeiras além das de conta e de mensagens. O detalhe de uso está no README, seção "Armazenamento".

## Decisões

| Decisão | Motivo | Revisitar quando |
|---|---|---|
| PostgreSQL opcional por `DATABASE_URL`, memória como padrão | Os dados passam a sobreviver ao reinício sem exigir banco de quem só roda os testes ou mexe numa tela | Se a memória deixar de ser usada fora dos testes |
| `pg` direto com um repositório genérico, sem ORM | A porta é só igualdade de campos: 23 repositórios cabem numa classe e numa lista de colunas por módulo | Quando as consultas (busca, agregações) forem para o banco |
| Arquivos no PostgreSQL (`stored_files`) | Funciona sem outro serviço; o disco do servidor publicado some a cada deploy. Troca a orientação anterior de não guardar bytes no banco | Volume de fotos crescer, ou o backup do banco pesar: ligar o bucket do Supabase Storage (`SUPABASE_*`) |
| Migrações em TypeScript aplicadas na subida | Sem ferramenta nem passo de deploy a mais; o `tsc` não copia `.sql` para o `dist/` | Mais de uma instância com migrações demoradas, ou necessidade de desfazer um passo |
| Transação só na contratação (aceite, recusa, desistência, propostas, pagamento) | É onde uma gravação pela metade trava o serviço; nos demais, as corridas são barradas por `UNIQUE` | Antes de pagamentos de verdade, ou no primeiro dado inconsistente |
| Proposta no módulo `hiring`; a conversa só exibe | A proposta é termo da contratação e destrava o aceite; o `hiring` lê a conversa pela porta `NegotiationChats` e avisa as etapas por `HiringEvents`, e o `chat` lê as propostas pela entrada pública do `hiring` | Se a negociação ganhar regras próprias (várias posições, valor de referência) |
| Combinado copiado no serviço (`services.agreement`) além do ponteiro `proposal_id` | A proposta aceita não muda; a cópia evita juntar tabelas em cada listagem. Só o produtor e o trabalhador aceito a recebem | Vaga com várias posições: o combinado passa para a candidatura |
| Pagamento simulado com o total informado pelo produtor | O combinado é por unidade (hora, dia, metro, hectare, empreitada), então nem sempre dá para calcular o total; o app sugere e o produtor confirma. Pagamento e conclusão gravam juntos (transação). `farmer_paid_at` e `worker_received_at` ficaram no banco sem uso | Pagamento real (gateway) |
| Valor estimado na vaga (`price` + `price_unit`), sem ordenação por valor | Ajuda a escolher a vaga e é o ponto de partida da proposta; comparar "por dia" com "por metro" não faz sentido | Se surgir uma unidade comum (ex.: valor por hora para todas) |
| Portas de repositório e container único | Troca de persistência sem tocar regras e rotas | Se uma consulta precisar de mais que igualdade de campos |
| OpenAPI gerado das rotas + e2e validando respostas | Documentação não diverge do comportamento | Se o custo de manter os schemas passar a atrapalhar |
| Contrato de tipos igual ao do frontend (`check:contracts`) | Evita divergência entre API e app | Se o frontend deixar de viver ao lado deste repositório |
| `ChangeFeed` em memória | Basta para um processo, também com PostgreSQL | Ao rodar mais de uma instância (README sugere LISTEN/NOTIFY ou Redis) |
| Um stream SSE por perfil | Limite de 6 conexões do HTTP/1.1 | Se o HTTP/2 for adotado (pendência registrada em PRODUCT.md) |
| Envio de push em segundo plano | Falha externa nunca derruba a resposta | Se for preciso garantia de entrega (fila) |

## Manutenção

Atualize este mapa quando mudarem diretórios, dependências relevantes, contratos ou fronteiras. Registre só comportamento verificado.
