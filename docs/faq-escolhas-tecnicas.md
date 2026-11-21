# FAQ: por que escolhemos cada tecnologia do Ruraliza

Perguntas curtas, para treinar respostas rápidas na apresentação. A base é o relatório [analise-tecnica.md](analise-tecnica.md) (18/11/2026), confirmado no código e nos documentos de cada repositório. `be/` é `ruraliza-backend/` e `fe/` é `ruraliza-frontend/`.

Quando o motivo está registrado no código ou nos docs, a resposta cita a fonte. Quando é só o motivo provável, a resposta leva **[A CONFIRMAR]** para você ajustar com o motivo real.

## Índice

**Frontend**

1. [Por que Angular em vez de React?](#1-por-que-angular-em-vez-de-react)
2. [Por que componentes standalone e Signals em vez de NgModules e NgRx?](#2-por-que-componentes-standalone-e-signals-em-vez-de-ngmodules-e-ngrx)
3. [Por que um PWA em vez de um app nativo?](#3-por-que-um-pwa-em-vez-de-um-app-nativo)
4. [Por que CSS próprio em vez de Tailwind ou Angular Material?](#4-por-que-css-próprio-em-vez-de-tailwind-ou-angular-material)
5. [Por que a sessão fica no sessionStorage em vez do localStorage ou de um cookie?](#5-por-que-a-sessão-fica-no-sessionstorage-em-vez-do-localstorage-ou-de-um-cookie)
6. [Por que pré-renderizar só 4 páginas em vez de usar SSR em tudo?](#6-por-que-pré-renderizar-só-4-páginas-em-vez-de-usar-ssr-em-tudo)

**Backend**

7. [Por que Node.js em vez de Java, Python ou outra linguagem?](#7-por-que-nodejs-em-vez-de-java-python-ou-outra-linguagem)
8. [Por que TypeScript em vez de JavaScript?](#8-por-que-typescript-em-vez-de-javascript)
9. [Por que Express em vez de NestJS ou Fastify?](#9-por-que-express-em-vez-de-nestjs-ou-fastify)
10. [Por que um token próprio em vez de JWT com biblioteca?](#10-por-que-um-token-próprio-em-vez-de-jwt-com-biblioteca)
11. [Por que autenticação própria em vez de Supabase Auth ou Firebase Auth?](#11-por-que-autenticação-própria-em-vez-de-supabase-auth-ou-firebase-auth)
12. [Por que scrypt em vez de bcrypt?](#12-por-que-scrypt-em-vez-de-bcrypt)
13. [Por que SSE em vez de WebSocket?](#13-por-que-sse-em-vez-de-websocket)
14. [Por que devolver Result em vez de lançar exceções?](#14-por-que-devolver-result-em-vez-de-lançar-exceções)
15. [Por que usar o sharp nas fotos?](#15-por-que-usar-o-sharp-nas-fotos)

**Banco e storage**

16. [Por que PostgreSQL em vez de MongoDB?](#16-por-que-postgresql-em-vez-de-mongodb)
17. [Por que Supabase em vez de Firebase?](#17-por-que-supabase-em-vez-de-firebase)
18. [Por que o driver pg direto em vez de um ORM como Prisma ou Sequelize?](#18-por-que-o-driver-pg-direto-em-vez-de-um-orm-como-prisma-ou-sequelize)
19. [Por que Supabase Storage em vez de guardar os arquivos no disco ou no S3?](#19-por-que-supabase-storage-em-vez-de-guardar-os-arquivos-no-disco-ou-no-s3)
20. [Por que migrações em TypeScript na subida em vez de uma ferramenta de migração?](#20-por-que-migrações-em-typescript-na-subida-em-vez-de-uma-ferramenta-de-migração)
21. [Por que existe um modo em memória além do PostgreSQL?](#21-por-que-existe-um-modo-em-memória-além-do-postgresql)

**Infraestrutura**

22. [Por que GitHub Pages em vez de Netlify ou Vercel para o frontend?](#22-por-que-github-pages-em-vez-de-netlify-ou-vercel-para-o-frontend)
23. [Por que Render em vez de Vercel ou Railway para o backend?](#23-por-que-render-em-vez-de-vercel-ou-railway-para-o-backend)
24. [Por que não hospedar tudo no mesmo lugar?](#24-por-que-não-hospedar-tudo-no-mesmo-lugar)
25. [Por que planos gratuitos em vez de um servidor pago desde o início?](#25-por-que-planos-gratuitos-em-vez-de-um-servidor-pago-desde-o-início)
26. [Por que sem Docker?](#26-por-que-sem-docker)

**Ferramentas e organização**

27. [Por que repositórios separados em vez de um monorepo?](#27-por-que-repositórios-separados-em-vez-de-um-monorepo)
28. [Por que node:test no backend em vez de Jest?](#28-por-que-nodetest-no-backend-em-vez-de-jest)
29. [Por que Vitest no frontend em vez de Karma ou Jest?](#29-por-que-vitest-no-frontend-em-vez-de-karma-ou-jest)
30. [Por que gerar o OpenAPI das rotas em vez de escrever o Swagger à mão?](#30-por-que-gerar-o-openapi-das-rotas-em-vez-de-escrever-o-swagger-à-mão)

---

## Frontend

### 1. Por que Angular em vez de React?

O Angular já traz, no próprio framework, as peças de que o app precisava: rotas, formulários, HttpClient com interceptors, service worker para o PWA e pré-renderização. Com React a gente teria que escolher e juntar uma biblioteca para cada uma. React também atenderia, mas aqui usamos todas essas peças, com três interceptors e o service worker no centro do app. **[A CONFIRMAR: o motivo da escolha não está registrado; ajuste se foi familiaridade da equipe ou exigência do curso.]** A desvantagem é ser um framework maior, e o projeto lida com isso com features carregadas sob demanda e um orçamento de bundle no build.

*Fontes: `fe/src/app/app.config.ts:19-22`, `fe/docs/architecture.md:80`, `fe/docs/architecture.md:88`.*

### 2. Por que componentes standalone e Signals em vez de NgModules e NgRx?

É o jeito atual do Angular, e ele deixa o código mais enxuto. O estado do app é pequeno: sessão, preferências e listas que são buscadas de novo quando chega um aviso. Por isso Signals dentro de serviços bastam, sem a cerimônia de actions e reducers do NgRx. NgRx também funcionaria, mas seria estrutura demais para esse estado. **[A CONFIRMAR: a troca de NgRx por Signals não está registrada como decisão.]**

*Fontes: `fe/src/app/core/session/current-user.service.ts:19-28`, `fe/src/app/shared/utils/remote-data.ts:5-30`.*

### 3. Por que um PWA em vez de um app nativo?

Porque o público usa celular, muitas vezes com sinal fraco, e o PWA resolve isso com um código só: dá para instalar, recebe push e funciona sem internet. Na prática, as leituras ficam no Cache Storage e as ações vão para uma fila. Um app nativo também atenderia, mas exigiria publicar em loja e manter outro código. **[A CONFIRMAR: a comparação com app nativo não está registrada.]**

*Fontes: `fe/PRODUCT.md:31`, `fe/docs/architecture.md:76`, `fe/src/app/core/offline/`.*

### 4. Por que CSS próprio em vez de Tailwind ou Angular Material?

Por causa da marca própria e dos temas de acessibilidade, que mudam por atributo no `<html>`: escuro, alto contraste e letra maior. Com tokens nossos, um script confere o contraste de todas as combinações nos quatro temas. A desvantagem é manter os próprios componentes, e o projeto lida com isso separando 18 componentes de interface dos de domínio.

*Fontes: `fe/docs/architecture.md:93` (tabela de decisões), `fe/src/styles/tokens.css`, `fe/scripts/check-contrast.mjs`.*

### 5. Por que a sessão fica no sessionStorage em vez do localStorage ou de um cookie?

Porque no campo o celular costuma ser dividido: fechou a aba, a sessão acaba e fica menos dado esquecido no aparelho. A desvantagem é ter que entrar de novo a cada aba, inclusive ao abrir uma notificação. Essa decisão está marcada para revisão junto com o produto.

*Fontes: `fe/docs/architecture.md:90` (tabela de decisões), `fe/PRODUCT.md:45`.*

### 6. Por que pré-renderizar só 4 páginas em vez de usar SSR em tudo?

Porque só a página inicial, os créditos, os termos e a privacidade são públicos e iguais para todo mundo. O resto depende de sessão e de um `:id`, então não ganha nada sendo renderizado no servidor. Isso também deixou o frontend como arquivos estáticos, que é o que permite hospedar no GitHub Pages. A desvantagem é que o build ainda gera um servidor SSR sem uso, que dá para remover.

*Fontes: `fe/src/app/app.routes.server.ts:6-17`, `fe/docs/architecture.md:82` (tabela de decisões).*

## Backend

### 7. Por que Node.js em vez de Java, Python ou outra linguagem?

Porque assim front e back usam a mesma linguagem, TypeScript. A vantagem concreta é que os tipos dos contratos da API são conferidos contra os do frontend pelo compilador, no `check:contracts`. Java ou Python também atenderiam, mas essa checagem teria que ser feita de outro jeito. **[A CONFIRMAR: o motivo não está registrado; ajuste se pesou a experiência da equipe.]**

*Fontes: `be/contract-check/frontend-parity.ts:28-35`.*

### 8. Por que TypeScript em vez de JavaScript?

Para pegar erro na compilação, e não em produção. O modo estrito foi ampliado, então até um índice de lista que pode não existir precisa ser tratado. É isso que permite comparar os tipos do backend e do frontend. A desvantagem é escrever mais tipos, e o lint proíbe `any` para que essa conta não fique pela metade.

*Fontes: `be/tsconfig.json:15-27`, `be/docs/quality.md:24`.*

### 9. Por que Express em vez de NestJS ou Fastify?

O Express 5 é simples e já repassa ao tratamento de erros as promessas que falham, o que era a principal limitação das versões anteriores. A organização que o Nest daria pronta foi feita à mão: módulos com entrada pública, um `container.ts` que liga tudo e uma função `route()` que junta rota, permissão e documentação. Nest ou Fastify também atenderiam. **[A CONFIRMAR: a comparação com Nest e Fastify não está registrada.]**

*Fontes: `be/app.ts:100-101`, `be/src/container.ts`, `be/src/shared/infra/http/route.ts:25-74`.*

### 10. Por que um token próprio em vez de JWT com biblioteca?

Porque só precisávamos do básico: quem entrou, de que tipo e até quando, assinado com HMAC. Isso sai em poucas linhas com o `crypto` nativo do Node, sem dependência. A conta é relida a cada requisição, então um perfil removido perde o acesso na hora. A desvantagem é não ter revogação nem renovação: sair ou trocar a senha não invalida o token, e isso está nos próximos passos.

*Fontes: `be/src/shared/infra/crypto/node-crypto.ts:44-69`, `be/src/modules/auth/presentation/access.ts:64-76`, `be/README.md:150`.*

### 11. Por que autenticação própria em vez de Supabase Auth ou Firebase Auth?

Porque a autenticação faz parte das regras do produto: uma conta com perfil de produtor e de trabalhador, e uma equipe interna com permissões. Mantendo isso no backend, do Supabase usamos só o banco e o storage, o que facilita trocar de provedor. Supabase Auth também atenderia, e ainda daria a redefinição de senha por e-mail que hoje não temos. **[A CONFIRMAR: o motivo não está registrado.]**

*Fontes: `be/src/modules/auth/`, `be/src/modules/system-users/domain/system-user.ts:15-34`.*

### 12. Por que scrypt em vez de bcrypt?

Porque o scrypt vem no próprio Node, sem instalar nada, e é um algoritmo feito para guardar senha. A senha leva sal aleatório e a comparação é em tempo constante. bcrypt também seria uma boa escolha, mas exigiria uma dependência a mais. **[A CONFIRMAR: o motivo não está registrado.]**

*Fontes: `be/src/shared/infra/crypto/node-crypto.ts:15-29`, `be/README.md:176`.*

### 13. Por que SSE em vez de WebSocket?

Porque o tempo real só vai do servidor para o app, e o aviso nem leva dados: só diz "busque de novo". SSE é HTTP comum, reconecta sozinho e não precisa de biblioteca. Como o navegador limita seis conexões por domínio no HTTP/1.1, usamos um único stream por perfil, dividido entre o sino, as conversas e as candidaturas. A desvantagem é que o feed vive na memória de um processo, então para mais de uma instância seria preciso LISTEN/NOTIFY do Postgres ou Redis.

*Fontes: `be/docs/architecture.md` (tabela de decisões: SSE e `ChangeFeed`), `fe/docs/architecture.md:73`.*

### 14. Por que devolver Result em vez de lançar exceções?

Porque o retorno do caso de uso mostra todos os desfechos possíveis, como ok, inválido, proibido e não encontrado, e o compilador obriga a tratar cada um. Um único `sendFailure` transforma isso no status HTTP certo, então nenhum controller decide status por conta própria. Exceção fica para o que é inesperado de verdade, e cai no tratador global como erro 500.

*Fontes: `be/src/shared/infra/http/respond.ts:16`, `be/app.ts:103-128`.*

### 15. Por que usar o sharp nas fotos?

Para converter toda foto em WebP de até 1000 px e tirar os metadados EXIF, que podem trazer a localização GPS de quem tirou. O arquivo fica menor, o que pesa no plano gratuito de storage e no sinal fraco, e protege a privacidade. A desvantagem é uma dependência nativa a mais no servidor.

*Fontes: `be/README.md:84`.*

## Banco e storage

### 16. Por que PostgreSQL em vez de MongoDB?

Porque os dados são relacionais: vaga, candidatura, pagamento, avaliação e conversa se ligam o tempo todo. A vantagem concreta é que regras como "só uma candidatura aceita por serviço" viram um índice único no banco, que barra até dois aceites ao mesmo tempo. MongoDB também guardaria os dados, mas essas garantias ficariam no código. **[A CONFIRMAR: a comparação com MongoDB não está registrada.]** A desvantagem honesta é que ainda há poucas chaves estrangeiras, e isso está nos próximos passos.

*Fontes: `be/src/migrations/001-initial.ts:112`, `be/docs/architecture.md` (seção "Como o PostgreSQL está montado").*

### 17. Por que Supabase em vez de Firebase?

Pelo custo-benefício: o plano gratuito dá um Postgres de verdade e storage, que é o que o projeto precisava. Como usamos só Postgres padrão e o storage, sair do Supabase é trocar a `DATABASE_URL` e o adaptador de arquivos. Firebase também atenderia, mas o banco dele não é relacional. **[A CONFIRMAR: a comparação com Firebase não está registrada.]** A desvantagem é que o projeto gratuito pausa depois de um tempo sem uso, então conferimos o painel antes de cada demonstração.

*Fontes: `be/src/shared/infra/postgres/database.ts`, `be/src/shared/infra/supabase/supabase-file-store.ts`.*

### 18. Por que o driver pg direto em vez de um ORM como Prisma ou Sequelize?

Porque os repositórios só precisam buscar por igualdade de campos, então uma classe genérica atende os 23, cada um com sua lista de colunas. O compilador recusa uma coluna esquecida, e todo valor vai por parâmetro, sem SQL montado na mão. A desvantagem é que buscas e somas ainda são feitas em memória, e levar isso para o SQL é o próximo passo. O Sequelize que aparece no `package.json` está instalado e sem uso, e pode sair.

*Fontes: `be/docs/architecture.md` (tabela de decisões), `be/src/shared/infra/postgres/pg-repository.ts`, `be/docs/quality.md:41`.*

### 19. Por que Supabase Storage em vez de guardar os arquivos no disco ou no S3?

Porque o disco do Render some a cada deploy, então foto salva lá se perderia. Primeiro os arquivos foram para uma tabela do banco, e depois para um bucket privado do Supabase Storage, aproveitando o mesmo serviço do banco. O app checa na subida se o bucket é privado e se recusa a subir se ele for público. S3 também atenderia, mas seria mais uma conta e mais uma cobrança. **[A CONFIRMAR: a comparação com S3 não está registrada.]**

*Fontes: `be/docs/architecture.md` (tabela de decisões: arquivos), `be/app.ts:164-167`, `be/src/shared/config.ts:25-33`.*

### 20. Por que migrações em TypeScript na subida em vez de uma ferramenta de migração?

Porque assim não existe ferramenta nem passo de deploy a mais: o servidor sobe e aplica o que falta, com um lock no banco para não rodar duas vezes. Também evita um detalhe do build, que não copia arquivos `.sql` para a pasta final. A desvantagem é não ter como desfazer uma migração, e o próprio documento diz para rever isso quando houver mais de uma instância.

*Fontes: `be/docs/architecture.md` (tabela de decisões), `be/src/shared/infra/postgres/migrate.ts:19-20`.*

### 21. Por que existe um modo em memória além do PostgreSQL?

Para quem só roda os testes ou mexe numa tela não precisar instalar banco. Os mesmos casos de uso rodam nas duas versões, e uma suíte confere que memória e Postgres se comportam igual. A desvantagem é que, sem a `DATABASE_URL`, a produção subiria em memória sem avisar, e hoje a variável está definida no Render.

*Fontes: `be/docs/architecture.md` (tabela de decisões), `be/tests/postgres/postgres.test.ts`, `be/app.ts:157-176`.*

## Infraestrutura

### 22. Por que GitHub Pages em vez de Netlify ou Vercel para o frontend?

Pelo custo-benefício: é gratuito e o código já está no GitHub, então o deploy é um workflow do Actions a cada push na `main`. Como o app é só arquivos estáticos, não precisa de mais nada. Netlify ou Vercel também atenderiam. **[A CONFIRMAR: a comparação com Netlify e Vercel não está registrada.]** A desvantagem é que o Pages não entende rotas de SPA, e o projeto resolve isso copiando o `index.html` para `404.html`.

*Fontes: `fe/.github/workflows/deploy.yml:39-54`, `fe/docs/architecture.md:81`.*

### 23. Por que Render em vez de Vercel ou Railway para o backend?

Pelo custo-benefício: o plano gratuito roda um servidor Node de verdade, que mantém as conexões SSE abertas e o pool do Postgres. Na Vercel, o backend viraria funções serverless, que combinam menos com conexões longas. **[A CONFIRMAR: a comparação com Vercel e Railway não está registrada.]** A desvantagem é que o serviço gratuito hiberna sem tráfego e demora para acordar. Por isso abrimos o sistema alguns minutos antes de demonstrar.

*Fontes: `fe/src/environments/environment.ts:3`, `be/src/shared/infra/http/sse.ts:21-41`, `be/docs/analise-tecnica.md` §8.*

### 24. Por que não hospedar tudo no mesmo lugar?

Porque cada parte ficou no plano gratuito que faz melhor aquilo: estático no Pages, a API no Render e banco e arquivos no Supabase. Render e Supabase ficam na mesma região dos Estados Unidos, então a conversa entre a API e o banco é curta. A desvantagem é ter três painéis e precisar de CORS. O CORS só libera o domínio do GitHub Pages.

*Fontes: `be/src/shared/config.ts:48-64`, `be/docs/analise-tecnica.md` §8.*

### 25. Por que planos gratuitos em vez de um servidor pago desde o início?

Porque o projeto ainda está em demonstração, e os planos gratuitos atendem essa demanda sem custo. Os limites de cada plano são conhecidos, e o caminho para sair deles é trocar o plano, sem mudar o código. A desvantagem é conviver com a hibernação do Render e a pausa do Supabase, que tratamos com uma checagem antes de cada uso importante.

*Fontes: `be/PRODUCT.md:36`, `be/docs/analise-tecnica.md` §8 e §13.*

### 26. Por que sem Docker?

Porque o Render roda Node direto a partir do repositório, então um container não era necessário para colocar a API no ar. A configuração fica no painel do Render. **[A CONFIRMAR: o motivo não está registrado.]** A desvantagem é que o deploy não é reproduzível só com o repositório, e um `render.yaml` ou um Dockerfile está entre as melhorias sugeridas.

*Fontes: `be/docs/analise-tecnica.md` §8 e §13.*

## Ferramentas e organização

### 27. Por que repositórios separados em vez de um monorepo?

Porque cada lado tem hospedagem e ciclo próprios: o front vai para o GitHub Pages e o back para o Render. Também usam ferramentas de teste e versões de Node diferentes. Um monorepo também funcionaria. **[A CONFIRMAR: o motivo não está registrado.]** A desvantagem é que os contratos podem divergir, e o `check:contracts` confere os tipos dos dois lados. Por enquanto ele roda fora do CI, porque precisa dos dois repositórios lado a lado.

*Fontes: `be/contract-check/frontend-parity.ts`, `be/docs/quality.md:20`.*

### 28. Por que node:test no backend em vez de Jest?

Porque o executor de testes já vem no Node, sem framework extra, e o `tsx` roda TypeScript direto, sem passo de build. Junto com o `ajv`, o e2e confere cada resposta contra a documentação OpenAPI. Jest também atenderia, mas seria mais uma dependência e mais configuração para TypeScript.

*Fontes: `be/docs/analise-tecnica.md` §3, `be/tests/e2e/support/openapi-check.ts`.*

### 29. Por que Vitest no frontend em vez de Karma ou Jest?

Porque é o executor que o próprio Angular passou a oferecer, pelo builder `@angular/build:unit-test`, e roda com `ng test` sem montar nada à parte. Os testes rodam em jsdom, sem abrir navegador, o que deixa o CI simples. **[A CONFIRMAR: o motivo não está registrado.]** A desvantagem é que jsdom não é um navegador real, e o projeto ainda não tem testes de ponta a ponta no navegador. Os fluxos principais são conferidos à mão.

*Fontes: `fe/angular.json:92`, `fe/PRODUCT.md:68`.*

### 30. Por que gerar o OpenAPI das rotas em vez de escrever o Swagger à mão?

Para a documentação não divergir do código. Cada rota é declarada uma vez só, com o handler, a regra de acesso e o schema juntos, e os testes de ponta a ponta conferem cada resposta contra esse schema. A desvantagem é manter os schemas atualizados, mas um schema desatualizado quebra o teste, então o erro aparece cedo.

*Fontes: `be/src/shared/infra/http/route.ts:25-74`, `be/docs/architecture.md` (tabela de decisões).*

---

## Itens [A CONFIRMAR]

Motivos que não estão registrados no código, nos docs nem no relatório. A resposta traz o motivo provável. Troque pelo motivo real antes de apresentar.

1. **Angular x React (pergunta 1):** se foi familiaridade da equipe, exigência do curso ou as peças integradas do Angular.
2. **Signals x NgRx (pergunta 2):** se a troca foi uma decisão consciente.
3. **PWA x app nativo (pergunta 3):** se a comparação chegou a ser feita.
4. **Node.js x outras linguagens (pergunta 7):** se pesou a mesma linguagem nos dois lados ou a experiência da equipe.
5. **Express x NestJS ou Fastify (pergunta 9).**
6. **Autenticação própria x Supabase Auth ou Firebase Auth (pergunta 11).**
7. **scrypt x bcrypt (pergunta 12).**
8. **PostgreSQL x MongoDB (pergunta 16).**
9. **Supabase x Firebase (pergunta 17):** além do custo, que já é conhecido.
10. **Supabase Storage x S3 (pergunta 19).**
11. **GitHub Pages x Netlify ou Vercel (pergunta 22):** além do custo, que já é conhecido.
12. **Render x Vercel ou Railway (pergunta 23):** além do custo, que já é conhecido.
13. **Sem Docker (pergunta 26).**
14. **Repositórios separados x monorepo (pergunta 27).**
15. **Vitest x Karma ou Jest (pergunta 29).**
