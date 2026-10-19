# Setup e evidências

Registro da adoção do [Vibe Coding Toolkit](https://github.com/soumatheusgomes/vibe-coding-toolkit) neste repositório. Diz o que foi configurado, com qual evidência e o que ficou pendente. As verificações do dia a dia estão em [quality.md](quality.md).

## Fonte e contexto

- **Data:** 18/10/2026. **Toolkit:** revisão `de66fe3` (17/10/2026), lida numa cópia temporária. Todos os guias e templates vêm dessa revisão.
- **Cliente:** Claude Code 2.1.296 (app desktop, Windows 11, Git Bash). O Codex não está instalado, então as configurações dele não se aplicam.
- **Runtime:** Node 24.19.0 e npm 11.17.0 locais; o CI usa Node 24.
- **Modelos:** a sessão principal usou o Opus 5.5. Os subagentes foram escolhidos pelo risco: Haiku para o caso mecânico do harness e Sonnet para os documentos, os outros casos e a revisão. Não houve troca de provedor, proxy nem API paga.
- **Branch:** `chore/vibe-coding-toolkit`, criada a partir de `origin/main` (com o PR #35 já integrado).

## Decisões

| Decisão | Motivo | Rever quando |
|---|---|---|
| Manter o ESLint atual (`strictTypeChecked`) e só somar `quality/max-lines` | Ele já cobre o perfil tipado do toolkit (`no-floating-promises` e `no-misused-promises`) e mais | — |
| `quality/no-direct-console` e `quality/no-direct-data-access` desligadas | Não há logger nem cliente de banco para proteger | Quando entrar um logger ou o PostgreSQL |
| `pg-harness` removido (autorizado pelo responsável pelo projeto) | Sem uso desde o primeiro commit; trazia 2 avisos críticos e 3 altos | — |
| `pg` e `sequelize` mantidos | Preparação para o PostgreSQL; a equipe decide quando | Na migração para o banco |
| Avisos do `uuid` (moderados) aceitos | A correção é um downgrade para o `sequelize` 3, que não é usado | Na migração para o banco |
| Skills de React e Next da Vercel não instaladas | É uma API Express | — |

## Componentes

| Componente | Ação | Escopo | Estado e evidência |
|---|---|---|---|
| AGENTS.md e CLAUDE.md | Criados, em português, com os comandos reais | Projeto | **Validado:** o cliente carregou o CLAUDE.md e descobriu as skills do repositório nesta sessão |
| Os 9 destinos do manifesto | AGENTS e CLAUDE (linha acima), PRODUCT, architecture, design (diz que critérios visuais não se aplicam a uma API), onboarding, quality e setup; o README já existia, continua o guia de uso e ganhou o mapa | Projeto | Revisados contra o código |
| Superpowers 7.0.0 e Ponytail 5.3.2 | `claude plugin install --scope local` na pasta `Ruraliza/` | Local, fora do git | **Validado:** as skills `superpowers:*` e `ponytail:*` apareceram carregadas na sessão do setup. Nenhuma delas foi executada como teste |
| Caveman | Não instalado; o estilo de saída **Concise**, já ativo, faz o mesmo papel | Usuário | Equivalente reaproveitado |
| RTK 1.0.1 | `rtk init -g --auto-patch` (autorizado), com backup do `settings.json` | Usuário | **Validado:** o `git status` deste repositório foi reescrito uma vez (-42%); repetir não duplicou o hook |
| Context7 | O conector do claude.ai, que já estava ativo | Usuário | **Validado:** consulta real feita nesta sessão |
| Graphify 0.9.92 (uv) | `.graphifyignore` e `graphify update . --no-cluster`; `graphify-out/` no `.gitignore` | Projeto (saída local) | **Validado:** 3047 nós e 10496 arestas, sem node_modules nem segredos; uma consulta respondeu. Sem extração semântica |
| `writing-guidelines` (vercel-labs/agent-skills), `find-skills` (vercel-labs/skills, MIT), `differential-review` (trailofbits/skills, CC-BY-SA-4.0) | `npx skills@1.7.2 add ... --agent claude-code --copy` | Projeto (`.claude/skills/`, `skills-lock.json`) | **Validado:** descobertas pelo cliente nesta sessão |
| Revisão de segurança (prompt 13) | Fonte e uso em [quality.md](quality.md#revisão-de-segurança) | Projeto | Documentado; nenhuma revisão completa rodou |
| CI (`ci.yml`) | Criado: `npm install`, `npm test` e `npm run build` | Projeto | YAML conferido; **sem execução remota** até alguém fazer push |
| Navegador | O navegador do app do Claude | Cliente | A API respondeu ao app local (login e vagas) |
| supabase-postgres-best-practices | Não se aplica | — | Não há banco, por decisão da equipe; instalar quando o PostgreSQL entrar |
| next-dev-loop, next-bundle-optimizer e shadcn | Não se aplicam | — | API sem interface |
| gh-fix-ci | Bloqueado | — | É para Codex (não instalado) e o `gh` não está autenticado |
| Sentry MCP, Obsidian, aia-harness | Não instalados | — | Sem Sentry no projeto e sem necessidade concreta |
| Hooks | Só o do RTK, no usuário | Usuário | Sem hooks no projeto e sem hooks do git |

## Verificações antes e depois

| Verificação | Antes (main) | Depois |
|---|---|---|
| `npm run typecheck` | ok | ok |
| `npm run lint` | 0 problemas | 0 erros e 1 aviso (`tests/e2e/smoke.e2e.ts` com 1489 linhas; teste, então só aviso) |
| `npm run check:rules` | — | ok |
| Unitários, integração e e2e | 276, 56 e 552 | 276, 56 e 552 |
| `npm run check:contracts` | ok | ok |
| `npm run build` | ok | ok |
| `npm audit` | 2 críticos, 3 altos, 2 moderados | 2 moderados (`uuid` no `sequelize`) |

Mudança de código: só dois comentários de `app.ts` que apontavam para arquivos que não existem mais.

## Memória e harness

A memória e a avaliação do harness valem para os dois repositórios e estão registradas no [setup.md do frontend](../../ruraliza-frontend/docs/setup.md#memória-e-harness), quando os dois estão lado a lado na pasta `Ruraliza/`. Em resumo:

- A memória nativa do Claude Code vale para a pasta `Ruraliza/`.
- Fatos duradouros deste repositório ficam nos documentos versionados.
- Os 3 casos de fixture do prompt 14 passaram e a reaplicação do setup não duplicou nada.

## Revisão independente

Dois revisores só de leitura (Sonnet, um por repositório) revisaram o diff contra `origin/main`, com os arquivos fora do commit. Ficaram de fora o conteúdo copiado (`.claude/skills/`, `eslint-rules/`) e o lockfile.

- Nenhum achado alto.
- Os 2 achados médios foram corrigidos: o prompt de segurança agora aponta para a revisão fixa (não para a `main`), e o "problema conhecido" desatualizado saiu (mais 5 comentários com caminhos antigos foram corrigidos).
- Os 8 achados baixos foram corrigidos (Node no README, regras de acesso, contrato e e2e no AGENTS.md, link do design.md, finais de linha, sem nome pessoal) ou ficaram registrados: o CI sem lockfile, as actions fixas por tag e os testes acima de 350 linhas, que só geram aviso.
- Depois das correções, a verificação completa passou de novo.
- Não foram cobertos: a execução remota do CI e o build AOT rodado pelo revisor (o coordenador rodou `ng build`).

## Pendências

- Fazer o primeiro push e conferir o `ci.yml` rodando no GitHub.
- Dividir `tests/e2e/smoke.e2e.ts` por fluxo, até ficar abaixo de 350 linhas por arquivo.
- Decidir se o `package-lock.json` passa a ser versionado; hoje o CI resolve versões novas a cada execução.
- Rodar a revisão de segurança de linha de base (prompt 13) quando quiserem.

## Como manter e repetir

- **Skills:** repita o `add` de cada skill de `skills-lock.json`, por exemplo `npx --yes skills@latest add vercel-labs/skills --skill find-skills --agent claude-code --copy --yes`. Depois revise o diff de `.claude/skills/` e `skills-lock.json`. Não use `skills update` sem `--agent`: no teste de reaplicação ele moveu o `find-skills` para `.agents/skills/` e deixou em `.claude/skills/` um link absoluto (que quebra em outra máquina). A cópia foi refeita com `--copy`.
- **Grafo:** `GRAPHIFY_NO_AUTO_REFRESH=1 graphify update . --no-cluster`.
- **Regras locais:** ao atualizar o toolkit, copie de novo `eslint-rules/*.cjs` e `scripts/verify-quality-rules.mjs` da mesma revisão e rode `npm run check:rules`.
- **Repetir o setup:** rode de novo o prompt 12 do toolkit e registre a nova revisão aqui.
