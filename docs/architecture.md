# Código e arquitetura

Visão técnica do que existe hoje. Rotas, variáveis e regras de negócio detalhadas ficam no [README](../README.md); o escopo do produto, em [PRODUCT.md](../PRODUCT.md).

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
| Persistência | Nenhuma: repositórios em memória (ver "Dados") |

`pg` e `sequelize` estão em `dependencies` para a futura troca para PostgreSQL, mas nenhum arquivo de `src/`, `app.ts` ou `tests/` os importa hoje. O `pg-harness`, também sem uso, saiu em 18/10/2026 porque trazia vulnerabilidades críticas (ver [setup.md](setup.md)).

## Mapa do código

```text
app.ts                  createApi(container): CORS, parsers de corpo, docs, rotas, 404 e erros; main() sobe o servidor (bootContainer: seed sempre, menos com SEED_DEMO=false fora do --dev)
contract-check/         frontend-parity.ts: igualdade de tipos com ../ruraliza-frontend/src/app/core/models
src/container.ts        raiz de composição: escolhe implementações e monta os casos de uso
src/repositories.ts     interface Repositories e a versão em memória
src/routes.ts           grupos de rotas por prefixo (/api/auth, /api/farmers, /api/workers...), na ordem de registro
src/seed*.ts            dados de demonstração (vagas, histórico, trilhas, verificação)
src/docs/               geração do documento OpenAPI e registro dos schemas
src/contracts/          barrel que reexporta os *.contract.ts, usado pelo check:contracts
src/modules/<módulo>/   fatia por contexto (22 pastas): accounts, admin, auth, chat, farm-stats, farmers, farms, help,
                        hiring, live, matching, media, notifications, platform, reports, reviews, services, sponsors,
                        system-users, tracks, verification, workers
src/shared/             domain (portas e regras puras), infra (http, crypto, imagens, memória, docs), utils, testing, config.ts
tests/                  integration/ (container, sem HTTP), setup/ (seed), e2e/ (HTTP real + openapi-check.ts)
docs/                   estudo-govbr-certificados.md e estes documentos
```

Dentro de um módulo, as pastas existem só quando há o que pôr nelas: `domain/` (porta do repositório e regras), `application/` (um `*.usecase.ts` por caso de uso, com `*.spec.ts` ao lado), `infra/` (repositório em memória e adaptadores), `presentation/` (controller, `*.routes.ts`, parsers, `*.schemas.ts`), `testing/` (fixtures, fora do build), mais `index.ts`, `<módulo>.module.ts` e `<nome>.contract.ts`. Alguns módulos são menores: `live` tem só `presentation/`, `admin` e `farm-stats` não têm `domain/` nem `infra/`.

## Fluxo de uma requisição

1. `app.ts` aplica CORS e os parsers de corpo: `express.json()`, e `express.raw()` para `image/*` (10 MB) e PDF (5 MB).
2. O roteador do prefixo (`buildRouter`) encontra a rota declarada com `route(método, caminho, handler, operation({...}), access)`.
3. `route()` chama `access.authorize(req)`: confere o token Bearer e o dono do recurso antes do handler.
4. O controller valida `req.body` e `req.query` (chegam como `unknown`) com parsers do módulo e monta a entrada tipada.
5. O caso de uso roda a regra e devolve um `Result` (`ok` ou falha com `invalid`, `unauthorized`, `forbidden`, `not_found`, `conflict`), sem nada de HTTP.
6. `sendFailure` traduz a falha em 400, 401, 403, 404 ou 409 com `{ "error": "mensagem" }`.
7. O caso de uso chama a porta do repositório; a implementação em memória guarda e devolve cópias.
8. Erros não tratados caem no `errorHandler` global: 400 para JSON inválido, 413 para corpo grande, 500 genérico para o resto (o detalhe vai só para o log).

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

Todos os repositórios são `InMemoryRepository` (`src/shared/infra/memory/`): arrays com id sequencial, assíncronos, que devolvem `structuredClone`, então alterar uma entidade só vale após `update`. Fotos, currículos e fotos de documentos de verificação ficam em `Map` na memória (`InMemoryImageStore`, `InMemoryDocumentStore`). Em desenvolvimento, tudo é recriado pelo seed ao subir; em produção, a API sobe vazia.

**Banco: plano, não implementação.** A troca por PostgreSQL é viável por desenho: casos de uso só conhecem portas e `createContainer({ repos, images, documents, changes })` aceita outras implementações. Faltam, e não existem no código: repositórios PostgreSQL, tabelas, migrações, seed para banco e transações no aceite e no pagamento. Os pontos pendentes estão marcados com `TODO(db)` (45 ocorrências em `src/`). O passo a passo previsto está no README, seção "Armazenamento temporário e migração para PostgreSQL".

## Decisões

| Decisão | Motivo | Revisitar quando |
|---|---|---|
| Dados em memória | A equipe decidiu não adicionar banco nesta fase; simplifica testes e demonstração | A equipe decidir lançar com dados reais ou perder dados virar problema |
| Portas de repositório e container único | Troca de persistência sem tocar regras e rotas | Ao escrever o primeiro repositório PostgreSQL |
| OpenAPI gerado das rotas + e2e validando respostas | Documentação não diverge do comportamento | Se o custo de manter os schemas passar a atrapalhar |
| Contrato de tipos igual ao do frontend (`check:contracts`) | Evita divergência entre API e app | Se o frontend deixar de viver ao lado deste repositório |
| `ChangeFeed` em memória | Basta para um processo | Ao rodar mais de uma instância (README sugere LISTEN/NOTIFY ou Redis) |
| Um stream SSE por perfil | Limite de 6 conexões do HTTP/1.1 | Se o HTTP/2 for adotado (pendência registrada em PRODUCT.md) |
| Envio de push e WhatsApp em segundo plano | Falha externa nunca derruba a resposta | Se for preciso garantia de entrega (fila) |

## Manutenção

Atualize este mapa quando mudarem diretórios, dependências relevantes, contratos ou fronteiras. Registre só comportamento verificado.
