# Ruraliza: API (backend)

Instruções para agentes de IA. São curtas de propósito: os detalhes estão nos documentos do mapa abaixo.

## Produto e stack

- **Produto e escopo:** [PRODUCT.md](PRODUCT.md). **Uso, rotas e dados de teste:** [README.md](README.md).
- **Stack:** Node.js 24, Express 5, TypeScript 6 estrito, npm. ESLint 10 com `typescript-eslint` (`strictTypeChecked`). Testes com `node:test` via `tsx`.
- **Dados em memória, por decisão da equipe:** não adicione banco, ORM ou migração sem um pedido explícito. `pg` e `sequelize` estão instalados para a troca futura, mas não são usados.
- **App:** o frontend Angular fica em `../ruraliza-frontend`. O contrato dos dois lados é conferido por `npm run check:contracts`.
- **Mapa:** [docs/architecture.md](docs/architecture.md) (estrutura e decisões), [docs/design.md](docs/design.md) (convenções de resposta e erro), [docs/onboarding.md](docs/onboarding.md) (primeira execução), [docs/quality.md](docs/quality.md) (verificações e revisão), [docs/setup.md](docs/setup.md) (ferramentas de agente e evidências).

## Comandos

- Instalar: `npm install` (o `package-lock.json` fica fora do git)
- Desenvolver: `npm run dev` (http://localhost:3000/api; recarrega ao salvar)
- Tipos: `npm run typecheck`
- Lint: `npm run lint`
- Autoteste das regras locais de lint: `npm run check:rules`
- Testes: `npm run test:unit`, `npm run test:integration` e `npm run test:e2e`
- Contrato com o frontend: `npm run check:contracts` (precisa de `../ruraliza-frontend`)
- Build: `npm run build`
- Verificação completa: `npm test` (tipos, lint, regras, unitários, integração e e2e)

## Como trabalhar aqui

- Leia o código e as instruções relevantes antes de editar. Separe o que observou, o que supôs, o que decidiu e a evidência.
- Defina o critério de aceite e o comando que o prova antes de implementar. Correção de bug começa reproduzindo o bug num teste.
- Faça a menor mudança completa. Reaproveite padrões, módulos e dependências que já existem.
- Toda rota é declarada com `route(...)` e `operation({...})` em `src/modules/*/presentation/*.routes.ts`. O e2e confere cada resposta contra o OpenAPI: mudou uma resposta, atualize o schema.
- Cada rota declara quem pode chamá-la no último argumento de `route(...)`: um `Access` com `audience` `public`, `account` ou `system` (`src/shared/infra/http/access.ts`). As permissões da equipe estão em `SYSTEM_PERMISSIONS` (`src/modules/system-users/domain/system-user.ts`). A API é quem protege os dados; nunca confie no app.
- Entre módulos, importe pela entrada pública `#modules/<módulo>`, nunca pelos arquivos internos de outro módulo.
- Mudou um `*.contract.ts`? O frontend tem de mudar junto: rode `npm run check:contracts`. Rota nova ou alterada também entra em `tests/e2e/smoke.e2e.ts`.
- `req.body` e `req.query` chegam como `unknown` e são validados em `src/shared/infra/http/body.ts` e nos parsers do módulo. Não confie em tipos sem validar.
- Mensagens de erro em português; não exponha stack, segredo ou dado pessoal em resposta ou log.
- Mudou comportamento, comando, contrato ou configuração? Atualize, na mesma mudança, o documento responsável.
- Publicar, enviar mensagens, gastar dinheiro e ações destrutivas só com autorização. Instalar uma ferramenta não autoriza usá-la para isso.
- Não adicione bloqueio de push na `main`, exigência de branch ou worktree, nem hooks `pre-commit` ou `pre-push`.

## Continuidade

- Um bloqueio para só o que depende dele; o resto autorizado continua.
- Ao retomar um trabalho, confira os arquivos, o `git status`, as verificações e os processos de verdade antes de confiar num resumo anterior.
- Trabalho que atravessa sessões ganha um handoff curto no plano ou na tarefa (modelo em [docs/quality.md](docs/quality.md#continuidade)). Progresso temporário não vira memória permanente.

## Ferramentas de agente

Plugins, hooks e conectores ficam na máquina de cada pessoa, não no repositório: use o que estiver instalado e, se faltar, siga o processo normal. Os detalhes, as versões e a evidência de cada ferramenta estão em [docs/setup.md](docs/setup.md).

- **Superpowers:** use as skills de processo (brainstorming, planos, depuração sistemática) na proporção do pedido. Instrução explícita e execução já autorizada valem mais que aprovações repetidas.
- **Ponytail (`full`):** a menor solução completa, sem cortar validação, segurança nem tratamento de erro. `stop ponytail` desliga.
- **Conversa concisa:** responda curto, no idioma de quem pede. Código, documentos e commits usam redação normal.
- **Context7:** consulte a documentação atual de bibliotecas e APIs, um conceito por vez. Nunca envie código privado, segredos ou dados pessoais.
- **RTK:** o hook do Claude Code reescreve os comandos suportados; não prefixe de novo. Use `rtk proxy <comando>` quando precisar da saída completa.
- **Graphify:** `graphify query "..."` responde perguntas de estrutura a partir de `graphify-out/graph.json`, gerado localmente sem LLM (fica fora do git e pode estar desatualizado ou não existir num clone novo). Atualize com `GRAPHIFY_NO_AUTO_REFRESH=1 graphify update . --no-cluster` e confirme no código o que o grafo sugerir.
- **Skills do projeto** (`.claude/skills/`, fontes em `skills-lock.json`):
  - `differential-review`: revisão de segurança de diffs que mexem em autenticação, permissões, dados pessoais ou tokens.
  - `writing-guidelines`: revisão de documentação.
  - `find-skills`: quando faltar uma capacidade concreta.
- **Revisão de segurança do repositório inteiro:** o prompt e as regras estão em [docs/quality.md](docs/quality.md#revisão-de-segurança).

## Delegação e revisão

- Delegue a subagentes só quando isolar contexto, especializar ou paralelizar compensar. Para buscas e tarefas mecânicas, prefira um modelo leve. Segurança, dados e revisão crítica pedem um modelo à altura do risco.
- Cada tarefa delegada recebe objetivo, contexto mínimo, arquivos permitidos, critério de aceite e as verificações. Cada arquivo tem um só autor. Revisores só leem. O coordenador confere o diff e roda as verificações.
- A revisão segue o risco e o diff real, como está em [docs/quality.md](docs/quality.md#revisão-depois-de-implementar).
